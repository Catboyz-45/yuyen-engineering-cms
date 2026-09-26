/**
 * หน้าที่ของไฟล์นี้: จำกัดจำนวนครั้งที่ลองรหัสผ่าน รหัส 2FA และรหัสกู้คืน ทั้งต่อบัญชีและต่อ IP
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ระบบนับครั้งก่อนตรวจรหัสเสมอ ยิงคำขอพร้อมกันจำนวนมากจึงเดาได้ไม่เกินโควตา
 * ผิดใกล้ครบโควตาจะหน่วงเวลาทีละน้อย ครบโควตาจะล็อก และล็อกนานขึ้นเท่าตัวทุกครั้งที่ผิดซ้ำ (สูงสุด 8 เท่า)
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { getAuthEnv } from "@/server/env";
import { keyedHash } from "@/server/security/crypto";

export type AuthThrottlePurpose =
  | "login"
  | "totp"
  | "totp-enrollment"
  | "recovery";
export type AuthThrottleScope = "account" | "ip";

export type AuthThrottleBucket = {
  key: string;
  thresholdMultiplier: number;
};

// ตัวนับที่ไม่ถูกใช้นานเกินนี้เริ่มนับใหม่ พิมพ์ผิดเป็นครั้งคราวจึงไม่สะสมตลอดไป
const STALE_AFTER_HOURS = 24;
// ล็อกนานขึ้นเท่าตัวทุกครั้งที่ผิดหลังครบโควตา แต่ไม่เกินจำนวนเท่านี้ของระยะล็อกปกติ
export const MAX_LOCKOUT_MULTIPLIER = 8;
// หน่วงเวลาก่อนครบโควตาไม่เกินกี่วินาที
const MAX_PROGRESSIVE_DELAY_SECONDS = 30;

/**
 * รหัส 2FA, การยืนยันตอนตั้งค่า 2FA และรหัสกู้คืน ใช้โควตาร่วมกันต่อบัญชี
 * ผู้โจมตีจึงไม่ได้โควตาเพิ่มจากการสลับไปลองอีกวิธีหนึ่ง
 */
function budgetFor(purpose: AuthThrottlePurpose) {
  return purpose === "login" ? "login" : "second-factor";
}

/** ฟังก์ชันสาธารณะ authThrottleKey เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function authThrottleKey(
  purpose: AuthThrottlePurpose,
  scope: AuthThrottleScope,
  subject: string,
) {
  return keyedHash(`${budgetFor(purpose)}:${scope}:${subject}`);
}

/** ตัวนับต่อบัญชี และต่อ IP (ที่อยู่เดียวกันในสำนักงานใช้ร่วมกันหลายบัญชี จึงให้โควตากว้างกว่า) */
export function authThrottleBuckets(
  purpose: AuthThrottlePurpose,
  account: string,
  ipHash: string,
): AuthThrottleBucket[] {
  return [
    { key: authThrottleKey(purpose, "account", account), thresholdMultiplier: 1 },
    { key: authThrottleKey(purpose, "ip", ipHash), thresholdMultiplier: 5 },
  ];
}

/** ฟังก์ชันสาธารณะ retryAfterSeconds เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function retryAfterSeconds(lockedUntil: Date, now = Date.now()) {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now) / 1000));
}

/** หน่วงเวลาก่อนครบโควตา: เริ่มเมื่อเหลืออีกไม่กี่ครั้ง แล้วเพิ่มเท่าตัว (คำนวณเหมือนกับใน SQL ของ consumeAttempt) */
export function calculateProgressiveDelaySeconds(
  failures: number,
  threshold: number,
) {
  if (failures >= threshold) return 0;
  const progressiveStart = Math.max(2, threshold - 3);
  if (failures < progressiveStart) return 0;
  return Math.min(MAX_PROGRESSIVE_DELAY_SECONDS, 2 ** (failures - progressiveStart));
}

/** เวลาที่ล็อกหลังจากนับครั้งที่ failures (null = ไม่ล็อก) คำนวณเหมือนกับใน SQL ของ consumeAttempt */
export function calculateLockout(
  failures: number,
  threshold: number,
  minutes: number,
  now = Date.now(),
) {
  if (failures >= threshold) {
    const multiplier = Math.min(2 ** Math.min(failures - threshold, 16), MAX_LOCKOUT_MULTIPLIER);
    return new Date(now + minutes * multiplier * 60_000);
  }
  const delaySeconds = calculateProgressiveDelaySeconds(failures, threshold);
  return delaySeconds ? new Date(now + delaySeconds * 1_000) : null;
}

export type AttemptResult = { allowed: true; lockedUntil: Date | null } | { allowed: false; lockedUntil: Date };

/**
 * นับหนึ่งครั้งแบบ atomic ก่อนตรวจรหัส คำขอที่ยิงพร้อมกันจึงผ่านการอ่าน "ยังไม่ล็อก" ค่าเก่าไม่ได้
 * ครั้งที่ทำให้ถึงเกณฑ์จะตั้งเวลาล็อกในคำสั่งเดียวกัน ระหว่างล็อกไม่มีแถวถูกแก้และคำขอถูกปฏิเสธ
 * allowed=true คืน lockedUntil ที่จะมีผลถ้าครั้งนี้ผิด (ถ้าถูก ผู้เรียกล้างด้วย clearFailures)
 */
export async function consumeAttempt(key: string, attempts: number, minutes: number): Promise<AttemptResult> {
  const progressiveStart = Math.max(2, attempts - 3);
  const failures = Prisma.sql`CASE WHEN "AuthThrottle"."updatedAt" < now() - make_interval(hours => ${STALE_AFTER_HOURS}::int) THEN 1 ELSE "AuthThrottle"."failures" + 1 END`;
  const lockout = (count: Prisma.Sql) => Prisma.sql`CASE
    WHEN ${count} >= ${attempts}::int
      THEN now() + make_interval(mins => LEAST(${minutes}::int * power(2, LEAST(${count} - ${attempts}::int, 16))::int, ${minutes * MAX_LOCKOUT_MULTIPLIER}::int))
    WHEN ${count} >= ${progressiveStart}::int
      THEN now() + make_interval(secs => LEAST(power(2, ${count} - ${progressiveStart}::int), ${MAX_PROGRESSIVE_DELAY_SECONDS}::int))
    END`;
  const rows = await db.$queryRaw<Array<{ lockedUntil: Date | null }>>`
    INSERT INTO "AuthThrottle" ("key", "failures", "lockedUntil", "updatedAt")
    VALUES (${key}, 1, ${lockout(Prisma.sql`1`)}, now())
    ON CONFLICT ("key") DO UPDATE SET "failures" = ${failures}, "lockedUntil" = ${lockout(failures)}, "updatedAt" = now()
    WHERE "AuthThrottle"."lockedUntil" IS NULL OR "AuthThrottle"."lockedUntil" <= now()
    RETURNING "lockedUntil"`;
  if (rows.length) return { allowed: true, lockedUntil: rows[0].lockedUntil };
  const row = await db.authThrottle.findUnique({ where: { key }, select: { lockedUntil: true } });
  return { allowed: false, lockedUntil: row?.lockedUntil ?? new Date(Date.now() + minutes * 60_000) };
}

/** นับครั้งนี้ในทุกตัวนับ; ถ้าตัวใดล็อกอยู่จะปฏิเสธทันที คืนเวลาล็อกที่ยาวที่สุดที่จะมีผลถ้าครั้งนี้ผิด */
export async function reserveAttempt(buckets: AuthThrottleBucket[]): Promise<AttemptResult> {
  const env = getAuthEnv();
  let latest: Date | null = null;
  for (const bucket of buckets) {
    const result = await consumeAttempt(bucket.key, env.AUTH_RATE_LIMIT_ATTEMPTS * bucket.thresholdMultiplier, env.AUTH_RATE_LIMIT_MINUTES);
    if (!result.allowed) return result;
    if (result.lockedUntil && (!latest || result.lockedUntil > latest)) latest = result.lockedUntil;
  }
  return { allowed: true, lockedUntil: latest };
}

/**
 * เมื่อยืนยันสำเร็จ: ล้างตัวนับต่อบัญชี และคืนครั้งที่จองไว้ให้ตัวนับต่อ IP (ลดลง 1)
 * ไม่ลบตัวนับต่อ IP ทั้งก้อน เพราะบัญชีหนึ่งสำเร็จไม่ควรลบร่องรอยการเดารหัสบัญชีอื่นจาก IP เดียวกัน
 * แต่ต้องคืนครั้งนี้ ไม่เช่นนั้นการล็อกอินปกติจากสำนักงานเดียวกัน (หรือเมื่อไม่ได้ตั้ง proxy) จะสะสมจนถูกล็อก
 */
export async function clearFailures(buckets: AuthThrottleBucket[]) {
  const accountKeys = buckets.filter(bucket => bucket.thresholdMultiplier === 1).map(bucket => bucket.key);
  const sharedKeys = buckets.filter(bucket => bucket.thresholdMultiplier !== 1).map(bucket => bucket.key);
  await db.$transaction([
    db.authThrottle.deleteMany({ where: { key: { in: accountKeys } } }),
    db.authThrottle.updateMany({ where: { key: { in: sharedKeys }, failures: { gt: 0 } }, data: { failures: { decrement: 1 } } }),
  ]);
}

/** ปลดล็อกบัญชีเมื่อ Super Admin รีเซ็ตรหัสผ่าน/2FA หรือกู้บัญชีฉุกเฉิน */
export async function clearAdminThrottles(admin: { id: string; usernameNormalized: string }) {
  await db.authThrottle.deleteMany({ where: { key: { in: [authThrottleKey("login", "account", admin.usernameNormalized), authThrottleKey("totp", "account", admin.id)] } } });
}
