import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/auth/audit";
import { updateAdminSafely } from "@/server/auth/admin-users";
import { cmsError, superAdminSession, validMutation } from "@/server/cms/http";
import { requestContext } from "@/server/security/request";
const schema = z.object({ displayName: z.string().trim().min(1).max(120).optional(), role: z.enum(["EDITOR", "SUPER_ADMIN"]).optional(), isActive: z.boolean().optional() }).strict();
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await superAdminSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = (await params).id; const context = requestContext(request);
  try {
    const input = schema.parse(await request.json()); const user = await updateAdminSafely(session.adminId, id, input);
    await audit({ actorId: session.adminId, action: "ADMIN_UPDATED", targetType: "Admin", targetId: id, result: "SUCCESS", metadata: { ...(input.role ? { role: input.role } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) }, ...context });
    return NextResponse.json({ user });
  } catch (error) { await audit({ actorId: session.adminId, action: "ADMIN_UPDATED", targetType: "Admin", targetId: id, result: "FAILURE", ...context }); return cmsError(error, context.requestId); }
}
