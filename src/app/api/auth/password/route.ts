import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import { getSessionByToken, rotateSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { clearFailures, consumeAttempt, throttleKeys } from "@/server/auth/throttle";
import { passwordSchema } from "@/server/auth/validation";
import { getAuthEnv } from "@/server/env";
import { hashPassword, verifyPassword } from "@/server/security/crypto";
import { assertSameOrigin, requestContext } from "@/server/security/request";

/**
 * Two cases are allowed: the forced change right after signing in with a temporary password, and a
 * voluntary change from a fully authenticated (2FA-verified) session that re-enters the current password.
 */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value); const parsed = passwordSchema.safeParse(await request.json().catch(() => null)); const context = requestContext(request);
  if (!session || !parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const forced = session.admin.mustChangePassword;
  if (!forced) {
    if (!session.twoFactorAt || !session.admin.twoFactorEnabled) return NextResponse.json({ error: "กรุณายืนยันตัวตนด้วย 2FA ก่อนเปลี่ยนรหัสผ่าน" }, { status: 403 });
    const env = getAuthEnv(); const throttleKey = throttleKeys.loginUser(session.admin.usernameNormalized);
    const attempt = await consumeAttempt(throttleKey, env.AUTH_RATE_LIMIT_ATTEMPTS, env.AUTH_RATE_LIMIT_MINUTES);
    if (!attempt.allowed) return NextResponse.json({ error: "ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่", retryAfter: attempt.lockedUntil.toISOString() }, { status: 429 });
    if (!parsed.data.currentPassword || !await verifyPassword(session.admin.passwordHash, parsed.data.currentPassword)) {
      await audit({ actorId: session.adminId, action: "AUTH_PASSWORD_CHANGED", result: "FAILURE", metadata: { reason: "CURRENT_PASSWORD_INVALID" }, ...context });
      return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง", fields: { currentPassword: ["รหัสผ่านปัจจุบันไม่ถูกต้อง"] } }, { status: 400 });
    }
    await clearFailures(throttleKey);
  }
  if (await verifyPassword(session.admin.passwordHash, parsed.data.password)) return NextResponse.json({ error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม", fields: { password: ["รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม"] } }, { status: 400 });
  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction([db.admin.update({ where: { id: session.adminId }, data: { passwordHash, mustChangePassword: false } }), db.session.updateMany({ where: { adminId: session.adminId, id: { not: session.id }, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "PASSWORD_CHANGED" } })]);
  // A voluntary change keeps the verified second factor; the forced first-sign-in flow still has to complete 2FA.
  const token = await rotateSession(session.id, forced ? "PASSWORD_VERIFIED" : "TWO_FACTOR_VERIFIED");
  await audit({ actorId: session.adminId, action: "AUTH_PASSWORD_CHANGED", result: "SUCCESS", metadata: { forced }, ...context });
  const next = !forced ? null : session.admin.twoFactorEnabled ? "/verify-2fa" : "/setup-2fa"; const response = NextResponse.json({ next }); response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: session.expiresAt }); return response;
}
