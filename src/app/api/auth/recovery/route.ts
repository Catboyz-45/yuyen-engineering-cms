import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import { getSessionByToken, rotateSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { clearFailures, consumeSecondFactorAttempt, throttleKeys } from "@/server/auth/throttle";
import { recoverySchema } from "@/server/auth/validation";
import { keyedHash } from "@/server/security/crypto";
import { normalizeRecoveryCode } from "@/server/security/recovery";
import { assertSameOrigin, requestContext } from "@/server/security/request";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value); const parsed = recoverySchema.safeParse(await request.json().catch(() => null)); const context = requestContext(request);
  if (!session || !parsed.success || session.twoFactorAt) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  const attempt = await consumeSecondFactorAttempt(session.adminId); if (!attempt.allowed) { await audit({ actorId: session.adminId, action: "AUTH_RECOVERY_CODE", result: "FAILURE", metadata: { reason: "RATE_LIMITED" }, ...context }); return NextResponse.json({ error: "ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่", retryAfter: attempt.lockedUntil.toISOString() }, { status: 429 }); }
  const codeHash = keyedHash(normalizeRecoveryCode(parsed.data.code));
  const consumed = await db.recoveryCode.updateMany({ where: { adminId: session.adminId, codeHash, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count !== 1) { await audit({ actorId: session.adminId, action: "AUTH_RECOVERY_CODE", result: "FAILURE", ...context }); return NextResponse.json({ error: "รหัสไม่ถูกต้องหรือถูกใช้แล้ว" }, { status: 401 }); }
  await clearFailures(throttleKeys.secondFactor(session.adminId)); const token = await rotateSession(session.id, "TWO_FACTOR_VERIFIED"); await audit({ actorId: session.adminId, action: "AUTH_RECOVERY_CODE", result: "SUCCESS", ...context });
  const response = NextResponse.json({ next: "/admin" }); response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: session.expiresAt }); return response;
}
