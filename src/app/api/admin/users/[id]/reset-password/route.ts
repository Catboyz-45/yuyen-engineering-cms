import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/server/auth/audit";
import { resetAdminPassword } from "@/server/auth/admin-users";
import { cmsError, superAdminSession, validMutation } from "@/server/cms/http";
import { requestContext } from "@/server/security/request";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await superAdminSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = (await params).id; const context = requestContext(request);
  try {
    const temporaryPassword = await resetAdminPassword(id);
    await audit({ actorId: session.adminId, action: "ADMIN_PASSWORD_RESET", targetType: "Admin", targetId: id, result: "SUCCESS", ...context });
    return NextResponse.json({ temporaryPassword }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { await audit({ actorId: session.adminId, action: "ADMIN_PASSWORD_RESET", targetType: "Admin", targetId: id, result: "FAILURE", ...context }); return cmsError(error, context.requestId); }
}
