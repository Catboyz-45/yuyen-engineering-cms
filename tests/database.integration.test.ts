import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { purgeAdmin, resetAdminPassword, resetAdminTwoFactor, restoreAdmin, trashAdmin, updateAdminSafely } from "@/server/auth/admin-users";
import { serializable } from "@/server/db/transaction";
import { publicReference } from "@/server/media/access";
import { clearFailures, consumeAttempt } from "@/server/auth/throttle";

const integration = process.env.RUN_INTEGRATION === "1";
const suite = describe.runIf(integration);
const prefix = `it-${randomUUID().slice(0, 8)}`;
const actorId = "integration-actor"; const extraIds: string[] = []; let firstId = ""; let secondId = "";

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
    await db.admin.deleteMany({ where: { OR: [{ usernameNormalized: { startsWith: prefix } }, { id: { in: [firstId, secondId, ...extraIds] } }] } });
    await db.$disconnect();
  });

  it("revokes active sessions when a role changes", async () => {
    const session = await db.session.create({ data: { tokenHash: "a".repeat(64), adminId: secondId, twoFactorAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
    await updateAdminSafely(actorId, secondId, { role: "EDITOR" });
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).toBeInstanceOf(Date);
  });

  it("prevents demotion and disablement of the final active Super Admin", async () => {
    await expect(updateAdminSafely(actorId, firstId, { role: "EDITOR" })).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
    await expect(updateAdminSafely(actorId, firstId, { isActive: false })).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
    await expect(trashAdmin(actorId, firstId)).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
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
  });
});
