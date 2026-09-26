/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ database.integration.test ยืนยันกฎความปลอดภัยที่ต้องพึ่งฐานข้อมูลจริง
 * (บัญชีผู้ดูแล การจำกัดจำนวนครั้ง เซสชัน TOTP การเก็บข้อมูล และสิทธิ์ดูไฟล์)
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { purgeAdmin, resetAdminPassword, resetAdminTwoFactor, restoreAdmin, trashAdmin, updateAdminSafely } from "@/server/auth/admin-users";
import { cleanupAuthenticationRecords } from "@/server/auth/cleanup";
import { clearFailures, consumeAttempt, reserveAttempt } from "@/server/auth/throttle";
import { auditCmsFailure } from "@/server/cms/http";
import { CmsError } from "@/server/cms/errors";
import { completeAuthentication } from "@/server/auth/session";
import { claimTotpTimeStep } from "@/server/auth/totp-replay";
import { serializable } from "@/server/db/transaction";
import { publicReference } from "@/server/media/access";

const integration = process.env.RUN_INTEGRATION === "1";
const suite = describe.runIf(integration);
const prefix = `it-${randomUUID().slice(0, 8)}`;
const actorId = "integration-actor"; const extraIds: string[] = []; let firstId = ""; let secondId = "";

/** ข้ามเฉพาะการหน่วงสั้นๆ ก่อนครบโควตา (ไม่เกิน 1 นาที) เพื่อทดสอบการนับและการล็อกเต็มโดยไม่ต้องรอจริง */
async function attemptPastDelay(key: string, attempts = 5, minutes = 15) {
  await db.authThrottle.updateMany({ where: { key, lockedUntil: { lte: new Date(Date.now() + 60_000) } }, data: { lockedUntil: new Date(Date.now() - 1000) } });
  return consumeAttempt(key, attempts, minutes);
}
const clearKey = (key: string) => db.authThrottle.deleteMany({ where: { key } });

suite("PostgreSQL security integration", () => {
  beforeAll(async () => {
    const users = await db.$transaction([
      db.admin.create({ data: { username: `${prefix}-one`, usernameNormalized: `${prefix}-one`, displayName: "Integration One", role: "SUPER_ADMIN", passwordHash: "integration-only-hash", mustChangePassword: false, twoFactorEnabled: true } }),
      db.admin.create({ data: { username: `${prefix}-two`, usernameNormalized: `${prefix}-two`, displayName: "Integration Two", role: "SUPER_ADMIN", passwordHash: "integration-only-hash", mustChangePassword: false, twoFactorEnabled: true } }),
    ]);
    firstId = users[0].id; secondId = users[1].id;
  });
  afterAll(async () => {
    await db.authThrottle.deleteMany({ where: { key: { startsWith: prefix } } });
    await db.banner.deleteMany({ where: { title: { startsWith: prefix } } });
    await db.media.deleteMany({ where: { objectKey: { startsWith: prefix } } });
    await db.auditLog.deleteMany({ where: { requestId: { startsWith: prefix } } });
    await db.admin.deleteMany({ where: { OR: [{ usernameNormalized: { startsWith: prefix } }, { id: { in: [firstId, secondId, ...extraIds] } }] } });
    await db.$disconnect();
  });

  it("revokes active sessions when a role changes", async () => {
    const session = await db.session.create({ data: { tokenHash: "a".repeat(64), adminId: secondId, twoFactorAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
    await updateAdminSafely(actorId, secondId, { role: "EDITOR" });
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).toBeInstanceOf(Date);
  });

  it("records the completed login time when the second factor succeeds", async () => {
    const session = await db.session.create({
      data: {
        tokenHash: "9".repeat(64),
        adminId: firstId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await completeAuthentication(session.id, firstId);

    const [updatedSession, admin] = await Promise.all([
      db.session.findUniqueOrThrow({ where: { id: session.id } }),
      db.admin.findUniqueOrThrow({ where: { id: firstId } }),
    ]);
    expect(updatedSession.twoFactorAt).toBeInstanceOf(Date);
    expect(admin.lastLoginAt).toBeInstanceOf(Date);
    expect(admin.lastLoginAt?.getTime()).toBe(updatedSession.twoFactorAt?.getTime());
  });

  it("atomically rejects reuse of the same TOTP time-step", async () => {
    const timeStep = Math.floor(Date.now() / 30_000);
    await db.admin.update({ where: { id: firstId }, data: { lastTotpTimeStep: null } });
    const attempts = await Promise.all([
      db.$transaction(tx => claimTotpTimeStep(tx, firstId, timeStep)),
      db.$transaction(tx => claimTotpTimeStep(tx, firstId, timeStep)),
    ]);
    expect(attempts.sort()).toEqual([false, true]);
    await expect(db.$transaction(tx => claimTotpTimeStep(tx, firstId, timeStep - 1))).resolves.toBe(false);
    await expect(db.$transaction(tx => claimTotpTimeStep(tx, firstId, timeStep + 1))).resolves.toBe(true);
  });

  it("prevents demotion and disablement of the final active Super Admin", async () => {
    // ฐานทดสอบอาจมี Super Admin อื่นจากชุดทดสอบอื่น ปิดไว้ชั่วคราวให้ firstId เป็นคนสุดท้ายจริง
    const others = await db.admin.findMany({ where: { id: { not: firstId }, role: "SUPER_ADMIN", isActive: true, deletedAt: null }, select: { id: true } });
    await db.admin.updateMany({ where: { id: { in: others.map(admin => admin.id) } }, data: { isActive: false } });
    try {
      await expect(updateAdminSafely(actorId, firstId, { role: "EDITOR" })).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
      await expect(updateAdminSafely(actorId, firstId, { isActive: false })).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
      await expect(trashAdmin(actorId, firstId)).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
    } finally {
      await db.admin.updateMany({ where: { id: { in: others.map(admin => admin.id) } }, data: { isActive: true } });
    }
  });

  it("refuses to change the role, status or trash state of one's own account", async () => {
    await expect(updateAdminSafely(firstId, firstId, { role: "EDITOR" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateAdminSafely(firstId, firstId, { isActive: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(trashAdmin(firstId, firstId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateAdminSafely(firstId, firstId, { displayName: "Integration One" })).resolves.toMatchObject({ displayName: "Integration One" });
  });

  it("reports unknown or trashed accounts as not found", async () => {
    await expect(resetAdminPassword("missing-admin-id")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(resetAdminTwoFactor("missing-admin-id")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateAdminSafely(actorId, "missing-admin-id", { displayName: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("trashes, restores disabled, and anonymizes administrator accounts while keeping audit links", async () => {
    const editor = await db.admin.create({ data: { username: `${prefix}-editor`, usernameNormalized: `${prefix}-editor`, displayName: "Integration Editor", role: "EDITOR", passwordHash: "integration-only-hash", mustChangePassword: false, twoFactorEnabled: true, totpSecretEncrypted: "v1.a.b.c" } });
    extraIds.push(editor.id);
    const session = await db.session.create({ data: { tokenHash: "b".repeat(64), adminId: editor.id, twoFactorAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
    const log = await db.auditLog.create({ data: { actorId: editor.id, action: "INTEGRATION_EVENT", result: "SUCCESS" } });

    await trashAdmin(actorId, editor.id);
    const trashed = await db.admin.findUniqueOrThrow({ where: { id: editor.id } });
    expect(trashed.deletedAt).toBeInstanceOf(Date);
    expect(trashed.purgeAt!.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).toBeInstanceOf(Date);
    await expect(resetAdminPassword(editor.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    await restoreAdmin(editor.id);
    expect(await db.admin.findUniqueOrThrow({ where: { id: editor.id } })).toMatchObject({ deletedAt: null, purgeAt: null, isActive: false });

    await expect(purgeAdmin(editor.id)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await trashAdmin(actorId, editor.id); await purgeAdmin(editor.id);
    const purged = await db.admin.findUniqueOrThrow({ where: { id: editor.id } });
    expect(purged).toMatchObject({ username: `deleted-${editor.id}`, displayName: "ผู้ดูแลที่ถูกลบ", totpSecretEncrypted: null, twoFactorEnabled: false, isActive: false, purgeAt: null });
    expect(purged.deletedAt).toBeInstanceOf(Date);
    expect(await db.session.count({ where: { adminId: editor.id } })).toBe(0);
    expect((await db.auditLog.findUniqueOrThrow({ where: { id: log.id } })).actorId).toBe(editor.id);
    await expect(restoreAdmin(editor.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.auditLog.delete({ where: { id: log.id } });
  });

  it("locks after the configured attempts and clears on success", async () => {
    const key = `${prefix}-lock`.padEnd(64, "0");
    for (let index = 0; index < 5; index += 1) expect((await attemptPastDelay(key)).allowed).toBe(true);
    const locked = await attemptPastDelay(key);
    expect(locked.allowed).toBe(false);
    if (!locked.allowed) expect(locked.lockedUntil.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    await clearKey(key);
    expect((await consumeAttempt(key, 5, 15)).allowed).toBe(true);
  });

  it("delays a quick retry before the limit is reached", async () => {
    const key = `${prefix}-delay`.padEnd(64, "0");
    expect(await consumeAttempt(key, 5, 15)).toMatchObject({ allowed: true, lockedUntil: null });
    const second = await consumeAttempt(key, 5, 15);
    expect(second.allowed).toBe(true);
    expect(second.lockedUntil!.getTime() - Date.now()).toBeLessThanOrEqual(1_000);
    expect((await consumeAttempt(key, 5, 15)).allowed).toBe(false);
  });

  it("admits no more than the limit from a parallel burst", async () => {
    const key = `${prefix}-burst`.padEnd(64, "0");
    // โควตา 2 ครั้ง: ครั้งที่ 2 ล็อกเต็มทันที จึงทดสอบเพดานได้โดยไม่ขึ้นกับการหน่วงก่อนครบโควตา
    const results = await Promise.all(Array.from({ length: 40 }, () => consumeAttempt(key, 2, 15)));
    expect(results.filter(result => result.allowed)).toHaveLength(2);
  });

  it("doubles the lockout after each failure past the limit, up to the cap", async () => {
    const key = `${prefix}-grow`.padEnd(64, "0");
    for (let index = 0; index < 5; index += 1) await attemptPastDelay(key);
    const lockMinutes = async () => { const row = await db.authThrottle.findUniqueOrThrow({ where: { key } }); return Math.round((row.lockedUntil!.getTime() - Date.now()) / 60_000); };
    expect(await lockMinutes()).toBe(15);
    for (const expected of [30, 60, 120, 120]) {
      await db.authThrottle.update({ where: { key }, data: { lockedUntil: new Date(Date.now() - 1000) } });
      expect((await consumeAttempt(key, 5, 15)).allowed).toBe(true);
      expect(await lockMinutes()).toBe(expected);
    }
  });

  it("restarts the count after a quiet period", async () => {
    const key = `${prefix}-stale`.padEnd(64, "0");
    for (let index = 0; index < 4; index += 1) await attemptPastDelay(key);
    await db.$executeRaw`UPDATE "AuthThrottle" SET "updatedAt" = now() - interval '25 hours', "lockedUntil" = NULL WHERE "key" = ${key}`;
    await consumeAttempt(key, 5, 15);
    expect((await db.authThrottle.findUniqueOrThrow({ where: { key } })).failures).toBe(1);
  });

  it("does not let successful sign-ins from a shared address lock that address", async () => {
    const buckets = [{ key: `${prefix}-acct`.padEnd(64, "0"), thresholdMultiplier: 1 }, { key: `${prefix}-ip`.padEnd(64, "0"), thresholdMultiplier: 5 }];
    for (let index = 0; index < 30; index += 1) {
      expect((await reserveAttempt(buckets)).allowed).toBe(true);
      await clearFailures(buckets);
    }
    expect((await db.authThrottle.findUnique({ where: { key: buckets[1].key } }))?.failures ?? 0).toBe(0);
    // การเดาผิดของ IP นั้นยังถูกนับอยู่ ความสำเร็จของบัญชีอื่นลบไม่ได้
    await reserveAttempt(buckets); await reserveAttempt([buckets[1]]);
    await clearFailures(buckets);
    expect((await db.authThrottle.findUniqueOrThrow({ where: { key: buckets[1].key } })).failures).toBe(1);
  });

  it("retries serializable transactions that conflict", async () => {
    const keyPrefix = `${prefix}-ser`;
    await Promise.all(Array.from({ length: 4 }, (_, index) => serializable(async tx => {
      const existing = await tx.authThrottle.count({ where: { key: { startsWith: keyPrefix } } });
      await new Promise(resolve => setTimeout(resolve, 20));
      await tx.authThrottle.create({ data: { key: `${keyPrefix}-${index}-${existing}`.padEnd(64, "0") } });
    })));
    expect(await db.authThrottle.count({ where: { key: { startsWith: keyPrefix } } })).toBe(4);
  });

  it("exposes media publicly only through published, live references", async () => {
    const media = await db.media.create({ data: { kind: "IMAGE", objectKey: `${prefix}/image.webp`, mimeType: "image/webp", sizeBytes: BigInt(10), status: "READY" } });
    const visible = () => db.media.findFirst({ where: { id: media.id, ...publicReference() }, select: { id: true } });
    const banner = await db.banner.create({ data: { title: `${prefix} banner`, imageId: media.id, status: "DRAFT" } });
    expect(await visible()).toBeNull();
    await db.banner.update({ where: { id: banner.id }, data: { status: "PUBLISHED", publishedAt: new Date(Date.now() + 3_600_000) } });
    expect(await visible()).toBeNull();
    await db.banner.update({ where: { id: banner.id }, data: { publishedAt: new Date(Date.now() - 1000) } });
    expect(await visible()).not.toBeNull();
    await db.banner.update({ where: { id: banner.id }, data: { deletedAt: new Date(), purgeAt: new Date(Date.now() + 86_400_000) } });
    expect(await visible()).toBeNull();
    await db.banner.delete({ where: { id: banner.id } });
    // รูปในแกลเลอรีบริษัทแสดงบนหน้าเกี่ยวกับเรา จึงต้องเปิดให้ผู้เยี่ยมชมเห็นได้
    const existing = await db.company.findUnique({ where: { singletonKey: "PRIMARY" }, select: { id: true } });
    const company = existing ?? await db.company.create({ data: { legalName: `${prefix} company`, displayName: `${prefix} company` }, select: { id: true } });
    try {
      await db.companyMedia.create({ data: { companyId: company.id, mediaId: media.id, sortOrder: 9_999 } });
      expect(await visible()).not.toBeNull();
    } finally {
      await db.companyMedia.deleteMany({ where: { mediaId: media.id } });
      if (!existing) await db.company.delete({ where: { id: company.id } });
    }
  });
  it("cleans only authentication records beyond retention", async () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const old = new Date("2026-06-01T00:00:00.000Z");
    const recent = new Date("2026-08-12T12:00:00.000Z");
    const future = new Date("2026-08-14T12:00:00.000Z");
    const tokens = {
      expired: "c".repeat(64),
      revoked: "d".repeat(64),
      recentRevoked: "e".repeat(64),
      active: "f".repeat(64),
    };
    const staleThrottle = "1".repeat(64);
    const activeThrottle = "2".repeat(64);
    const recentThrottle = "3".repeat(64);

    await db.$transaction([
      db.session.create({ data: { tokenHash: tokens.expired, adminId: firstId, expiresAt: old, lastSeenAt: old } }),
      db.session.create({ data: { tokenHash: tokens.revoked, adminId: firstId, expiresAt: future, revokedAt: old, lastSeenAt: old } }),
      db.session.create({ data: { tokenHash: tokens.recentRevoked, adminId: firstId, expiresAt: future, revokedAt: recent, lastSeenAt: recent } }),
      db.session.create({ data: { tokenHash: tokens.active, adminId: firstId, expiresAt: future, lastSeenAt: now } }),
      db.authThrottle.create({ data: { key: staleThrottle, failures: 1, updatedAt: old } }),
      db.authThrottle.create({ data: { key: activeThrottle, failures: 5, lockedUntil: future, updatedAt: old } }),
      db.authThrottle.create({ data: { key: recentThrottle, failures: 1, updatedAt: recent } }),
    ]);

    const result = await cleanupAuthenticationRecords(db, {
      now,
      sessionRetentionDays: 30,
      throttleRetentionDays: 7,
      sessionIdleMinutes: 30,
    });

    expect(result).toEqual({ sessionsDeleted: 2, throttlesDeleted: 1 });
    expect(await db.session.count({ where: { tokenHash: { in: [tokens.expired, tokens.revoked] } } })).toBe(0);
    expect(await db.session.count({ where: { tokenHash: { in: [tokens.recentRevoked, tokens.active] } } })).toBe(2);
    expect(await db.authThrottle.findUnique({ where: { key: staleThrottle } })).toBeNull();
    expect(await db.authThrottle.count({ where: { key: { in: [activeThrottle, recentThrottle] } } })).toBe(2);

    await db.$transaction([
      db.session.deleteMany({ where: { tokenHash: { in: [tokens.recentRevoked, tokens.active] } } }),
      db.authThrottle.deleteMany({ where: { key: { in: [activeThrottle, recentThrottle] } } }),
      db.auditLog.deleteMany({ where: { action: "AUTH_RETENTION_CLEANUP_COMPLETED", createdAt: { gte: new Date(Date.now() - 60_000) } } }),
    ]);
  });

  it("persists failed CMS actions with a safe error code", async () => {
    const requestId = `${prefix}-cms-failure`;
    await auditCmsFailure({ actorId: firstId, action: "CONTENT_PUBLISH_FAILED", kind: "news", targetId: `${prefix}-target`, context: { requestId, ipHash: "hash", userAgent: "integration-test" }, error: new CmsError("INVALID_TRANSITION", "sensitive internal detail") });
    const entry = await db.auditLog.findFirstOrThrow({ where: { requestId } });
    expect(entry).toMatchObject({ actorId: firstId, action: "CONTENT_PUBLISH_FAILED", targetType: "News", targetId: `${prefix}-target`, result: "FAILURE", errorCode: "INVALID_TRANSITION" });
    expect(JSON.stringify(entry.metadata)).not.toContain("sensitive internal detail");
  });
});
