import "server-only";
import type { AdminRole, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { serializable } from "@/server/db/transaction";
import { CmsError } from "@/server/cms/errors";
import { retentionDate } from "@/server/cms/rules";
import { hashPassword, randomToken } from "@/server/security/crypto";
import { anonymizedAdminData } from "./admin-retention";
import { revokeUserSessions } from "./session";
import { clearAdminThrottles } from "./throttle";

const notFound = () => new CmsError("NOT_FOUND", "ไม่พบบัญชีผู้ดูแล");

async function findLiveAdmin(tx: Prisma.TransactionClient, userId: string) {
  const target = await tx.admin.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) throw notFound();
  return target;
}

/** Throws when the change would leave no active Super Admin able to manage accounts. */
async function assertSuperAdminRemains(tx: Prisma.TransactionClient, target: { id: string; role: AdminRole; isActive: boolean; deletedAt: Date | null }) {
  if (target.role !== "SUPER_ADMIN" || !target.isActive || target.deletedAt) return;
  const others = await tx.admin.count({ where: { id: { not: target.id }, role: "SUPER_ADMIN", isActive: true, deletedAt: null } });
  if (others < 1) throw new CmsError("LAST_SUPER_ADMIN", "ไม่สามารถเปลี่ยน Super Admin คนสุดท้ายได้");
}

export async function createAdmin(input: { username: string; displayName: string; role: AdminRole }) {
  const temporaryPassword = `${randomToken(12)}Aa!1`; const passwordHash = await hashPassword(temporaryPassword);
  const normalized = input.username.toLowerCase(); const user = await db.admin.create({ data: { username: input.username, usernameNormalized: normalized, displayName: input.displayName, role: input.role, passwordHash, mustChangePassword: true } });
  return { user, temporaryPassword };
}

export async function updateAdminSafely(actorId: string, userId: string, input: { displayName?: string; role?: AdminRole; isActive?: boolean }) {
  if (actorId === userId && (input.role !== undefined || input.isActive !== undefined)) throw new CmsError("FORBIDDEN", "ไม่สามารถเปลี่ยนบทบาทหรือสถานะของบัญชีตัวเองได้");
  const result = await serializable(async tx => {
    const target = await findLiveAdmin(tx, userId);
    if (input.role === "EDITOR" || input.isActive === false) await assertSuperAdminRemains(tx, target);
    return tx.admin.update({ where: { id: userId }, data: input, select: { id: true, username: true, displayName: true, role: true, isActive: true } });
  });
  if (input.role !== undefined || input.isActive !== undefined) await revokeUserSessions(userId);
  return result;
}

export async function resetAdminPassword(userId: string) {
  const temporaryPassword = `${randomToken(12)}Aa!1`; const passwordHash = await hashPassword(temporaryPassword);
  const user = await serializable(async tx => { await findLiveAdmin(tx, userId); return tx.admin.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } }); });
  await revokeUserSessions(userId);
  await clearAdminThrottles(user);
  return temporaryPassword;
}

export async function resetAdminTwoFactor(userId: string) {
  const user = await serializable(async tx => {
    await findLiveAdmin(tx, userId);
    const updated = await tx.admin.update({ where: { id: userId }, data: { twoFactorEnabled: false, totpSecretEncrypted: null, totpKeyVersion: null } });
    await tx.recoveryCode.deleteMany({ where: { adminId: userId } });
    await tx.session.updateMany({ where: { adminId: userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "TWO_FACTOR_RESET" } });
    return updated;
  });
  await clearAdminThrottles(user);
}

export async function trashAdmin(actorId: string, userId: string) {
  if (actorId === userId) throw new CmsError("FORBIDDEN", "ไม่สามารถย้ายบัญชีตัวเองไปถังขยะได้");
  await serializable(async tx => {
    const target = await findLiveAdmin(tx, userId);
    await assertSuperAdminRemains(tx, target);
    await tx.admin.update({ where: { id: userId }, data: { deletedAt: new Date(), purgeAt: retentionDate() } });
    await tx.session.updateMany({ where: { adminId: userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "ACCOUNT_TRASHED" } });
  });
}

/** Restored accounts come back disabled so a Super Admin must deliberately re-enable access. */
export async function restoreAdmin(userId: string) {
  await serializable(async tx => {
    const target = await tx.admin.findUnique({ where: { id: userId }, select: { deletedAt: true, purgeAt: true } });
    if (!target?.deletedAt || !target.purgeAt) throw notFound();
    await tx.admin.update({ where: { id: userId }, data: { deletedAt: null, purgeAt: null, isActive: false } });
  });
}

/**
 * Permanent deletion keeps the row so audit history still points at a stable actor, but removes the
 * person's name, username and every credential. The account can never sign in again.
 */
export async function purgeAdmin(userId: string) {
  const passwordHash = await hashPassword(randomToken(32));
  await serializable(async tx => {
    const target = await tx.admin.findUnique({ where: { id: userId }, select: { deletedAt: true, purgeAt: true } });
    if (!target?.deletedAt || !target.purgeAt) throw new CmsError("INVALID_TRANSITION", "ต้องย้ายบัญชีไปถังขยะก่อนลบถาวร");
    await tx.recoveryCode.deleteMany({ where: { adminId: userId } });
    await tx.session.deleteMany({ where: { adminId: userId } });
    await tx.admin.update({ where: { id: userId }, data: anonymizedAdminData(userId, passwordHash) });
  });
}
