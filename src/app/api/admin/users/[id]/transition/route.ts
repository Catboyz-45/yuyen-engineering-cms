import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/auth/audit";
import { purgeAdmin, restoreAdmin, trashAdmin } from "@/server/auth/admin-users";
import { cmsError, superAdminSession, validMutation } from "@/server/cms/http";
import { requestContext } from "@/server/security/request";
const schema = z.object({ action: z.enum(["trash", "restore", "delete"]) }).strict();
const actions = { trash: "ADMIN_TRASHED", restore: "ADMIN_RESTORED", delete: "ADMIN_DELETED_PERMANENTLY" } as const;
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await superAdminSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = (await params).id; const context = requestContext(request); let action: keyof typeof actions | undefined;
  try {
    action = schema.parse(await request.json()).action;
    if (action === "trash") await trashAdmin(session.adminId, id); else if (action === "restore") await restoreAdmin(id); else await purgeAdmin(id);
    await audit({ actorId: session.adminId, action: actions[action], targetType: "Admin", targetId: id, result: "SUCCESS", ...context });
    return NextResponse.json({ success: true });
  } catch (error) { await audit({ actorId: session.adminId, action: action ? actions[action] : "ADMIN_TRANSITION", targetType: "Admin", targetId: id, result: "FAILURE", ...context }); return cmsError(error, context.requestId); }
}
