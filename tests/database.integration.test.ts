import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { updateAdminSafely } from "@/server/auth/admin-users";
import { clearFailures, consumeAttempt } from "@/server/auth/throttle";

const integration = process.env.RUN_INTEGRATION === "1";
const suite = describe.runIf(integration);
const prefix = `it-${randomUUID().slice(0, 8)}`;
let firstId = ""; let secondId = "";

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
    await db.admin.deleteMany({ where: { usernameNormalized: { startsWith: prefix } } });
    await db.$disconnect();
  });

  it("revokes active sessions when a role changes", async () => {
    const session = await db.session.create({ data: { tokenHash: "a".repeat(64), adminId: secondId, twoFactorAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
    await updateAdminSafely(secondId, { role: "EDITOR" });
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).toBeInstanceOf(Date);
  });

  it("prevents demotion and disablement of the final active Super Admin", async () => {
    await expect(updateAdminSafely(firstId, { role: "EDITOR" })).rejects.toThrow("LAST_SUPER_ADMIN");
    await expect(updateAdminSafely(firstId, { isActive: false })).rejects.toThrow("LAST_SUPER_ADMIN");
  });

  it("locks after the configured attempts and clears on success", async () => {
    const key = `${prefix}-lock`.padEnd(64, "0");
    for (let index = 0; index < 5; index += 1) expect((await consumeAttempt(key, 5, 15)).allowed).toBe(true);
    const locked = await consumeAttempt(key, 5, 15);
    expect(locked.allowed).toBe(false);
    if (!locked.allowed) expect(locked.lockedUntil.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    await clearFailures(key);
    expect((await consumeAttempt(key, 5, 15)).allowed).toBe(true);
  });

  it("admits no more than the limit from a parallel burst", async () => {
    const key = `${prefix}-burst`.padEnd(64, "0");
    const results = await Promise.all(Array.from({ length: 40 }, () => consumeAttempt(key, 5, 15)));
    expect(results.filter(result => result.allowed)).toHaveLength(5);
  });

  it("doubles the lockout after each failure past the limit, up to the cap", async () => {
    const key = `${prefix}-grow`.padEnd(64, "0");
    for (let index = 0; index < 5; index += 1) await consumeAttempt(key, 5, 15);
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
    for (let index = 0; index < 4; index += 1) await consumeAttempt(key, 5, 15);
    await db.$executeRaw`UPDATE "AuthThrottle" SET "updatedAt" = now() - interval '25 hours' WHERE "key" = ${key}`;
    await consumeAttempt(key, 5, 15);
    expect((await db.authThrottle.findUniqueOrThrow({ where: { key } })).failures).toBe(1);
  });
});
