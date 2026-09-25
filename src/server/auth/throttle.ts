import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { getAuthEnv } from "@/server/env";
import { keyedHash } from "@/server/security/crypto";

// Counters older than this restart from zero so occasional typos do not accumulate forever.
const STALE_AFTER_HOURS = 24;
// Lockouts double after every further failure but never exceed this multiple of the base window.
const MAX_LOCKOUT_MULTIPLIER = 8;

export const throttleKeys = {
  loginUser: (usernameNormalized: string) => keyedHash(`login-user:${usernameNormalized}`),
  loginIp: (ipHash: string) => keyedHash(`login-ip:${ipHash}`),
  secondFactor: (adminId: string) => keyedHash(`second-factor:${adminId}`),
};

export type AttemptResult = { allowed: true } | { allowed: false; lockedUntil: Date };

/**
 * Atomically records one attempt before the credential is checked, so parallel requests cannot all
 * pass a stale "not locked" read. The attempt that reaches the limit sets the lockout in the same
 * statement; while a lockout is active no row is updated and the attempt is refused.
 */
export async function consumeAttempt(key: string, attempts: number, minutes: number): Promise<AttemptResult> {
  const failures = Prisma.sql`CASE WHEN "AuthThrottle"."updatedAt" < now() - make_interval(hours => ${STALE_AFTER_HOURS}::int) THEN 1 ELSE "AuthThrottle"."failures" + 1 END`;
  const lockout = (count: Prisma.Sql) => Prisma.sql`CASE WHEN ${count} >= ${attempts}::int
    THEN now() + make_interval(mins => LEAST(${minutes}::int * power(2, LEAST(${count} - ${attempts}::int, 16))::int, ${minutes * MAX_LOCKOUT_MULTIPLIER}::int)) END`;
  const rows = await db.$queryRaw<Array<{ failures: number }>>`
    INSERT INTO "AuthThrottle" ("key", "failures", "lockedUntil", "updatedAt")
    VALUES (${key}, 1, ${lockout(Prisma.sql`1`)}, now())
    ON CONFLICT ("key") DO UPDATE SET "failures" = ${failures}, "lockedUntil" = ${lockout(failures)}, "updatedAt" = now()
    WHERE "AuthThrottle"."lockedUntil" IS NULL OR "AuthThrottle"."lockedUntil" <= now()
    RETURNING "failures"`;
  if (rows.length) return { allowed: true };
  const row = await db.authThrottle.findUnique({ where: { key }, select: { lockedUntil: true } });
  return { allowed: false, lockedUntil: row?.lockedUntil ?? new Date(Date.now() + minutes * 60_000) };
}

export async function consumeLoginAttempt(usernameNormalized: string, ipHash: string | null): Promise<AttemptResult> {
  const env = getAuthEnv();
  const user = await consumeAttempt(throttleKeys.loginUser(usernameNormalized), env.AUTH_RATE_LIMIT_ATTEMPTS, env.AUTH_RATE_LIMIT_MINUTES);
  if (!user.allowed || !ipHash) return user;
  // A shared office address sees several administrators, so the per-address budget is wider.
  return consumeAttempt(throttleKeys.loginIp(ipHash), env.AUTH_RATE_LIMIT_ATTEMPTS * 4, env.AUTH_RATE_LIMIT_MINUTES);
}

export async function consumeSecondFactorAttempt(adminId: string): Promise<AttemptResult> {
  const env = getAuthEnv();
  return consumeAttempt(throttleKeys.secondFactor(adminId), env.AUTH_RATE_LIMIT_ATTEMPTS, env.AUTH_RATE_LIMIT_MINUTES);
}

export async function clearFailures(...keys: string[]) { await db.authThrottle.deleteMany({ where: { key: { in: keys } } }); }
export function clearAdminThrottles(admin: { id: string; usernameNormalized: string }) { return clearFailures(throttleKeys.loginUser(admin.usernameNormalized), throttleKeys.secondFactor(admin.id)); }

