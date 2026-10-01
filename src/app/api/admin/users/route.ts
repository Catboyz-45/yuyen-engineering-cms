import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import { createAdmin } from "@/server/auth/admin-users";
import { cmsError, superAdminSession, validMutation } from "@/server/cms/http";
import { requestContext } from "@/server/security/request";
const schema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[a-zA-Z0-9._-]+$/),
    displayName: z.string().trim().min(1).max(120),
    role: z.enum(["EDITOR", "SUPER_ADMIN"]),
  })
  .strict();
// Anonymized accounts (deletedAt set, purgeAt cleared) are kept only as audit anchors and are not listed.
export async function GET() {
  const session = await superAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = await db.admin.findMany({
    where: { OR: [{ deletedAt: null }, { purgeAt: { not: null } }] },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      twoFactorEnabled: true,
      createdAt: true,
      deletedAt: true,
      purgeAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ currentUserId: session.adminId, users }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await superAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const context = requestContext(request);
  try {
    const result = await createAdmin(schema.parse(await request.json()));
    await audit({
      actorId: session.adminId,
      action: "ADMIN_CREATED",
      targetType: "Admin",
      targetId: result.user.id,
      result: "SUCCESS",
      metadata: { role: result.user.role },
      ...context,
    });
    return NextResponse.json(
      {
        user: {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName,
          role: result.user.role,
        },
        temporaryPassword: result.temporaryPassword,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await audit({
      actorId: session.adminId,
      action: "ADMIN_CREATED",
      targetType: "Admin",
      result: "FAILURE",
      ...context,
    });
    return cmsError(error, context.requestId);
  }
}
