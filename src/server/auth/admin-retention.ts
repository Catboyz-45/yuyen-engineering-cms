// Shared by the Next.js server and the retention script, so it must not import "server-only".

/** Replaces every personal or credential field of a trashed administrator; purgeAt: null marks it as done. */
export function anonymizedAdminData(adminId: string, unusablePasswordHash: string) {
  const username = `deleted-${adminId}`;
  return {
    username, usernameNormalized: username, displayName: "ผู้ดูแลที่ถูกลบ", role: "EDITOR" as const, passwordHash: unusablePasswordHash,
    mustChangePassword: true, totpSecretEncrypted: null, totpKeyVersion: null, twoFactorEnabled: false, failedLoginAttempts: 0,
    lockedUntil: null, isActive: false, lastLoginAt: null, purgeAt: null,
  };
}
