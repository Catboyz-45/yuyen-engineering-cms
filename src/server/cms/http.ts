/**
 * หน้าที่ของไฟล์นี้: ชั้น service http รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { currentSession } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/request";
import { CmsError } from "./errors";
import { errorDetails, log } from "@/server/observability/logger";
import { randomUUID } from "node:crypto";
import { audit } from "@/server/auth/audit";
import type { ContentKind } from "./schemas";

const contentLabels: Record<ContentKind, string> = { banners: "Banner", services: "Service", products: "Product", projects: "Project", news: "News" };

/** ฟังก์ชันสาธารณะ cmsAuditErrorCode เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function cmsAuditErrorCode(error: unknown) {
  if (error instanceof ZodError) return "VALIDATION_ERROR";
  if (error instanceof CmsError) return error.code;
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  return "INTERNAL_ERROR";
}

/** บันทึกเหตุการณ์ผ่าน auditCmsFailure เพื่อให้ตรวจสอบย้อนหลังได้ โดยไม่ควรใส่รหัสผ่านหรือ token */
export async function auditCmsFailure(input: { actorId: string; action: string; kind?: ContentKind; targetId?: string; context: ReturnType<typeof import("@/server/security/request").requestContext>; error: unknown }) {
  await audit({ actorId: input.actorId, action: input.action, targetType: input.kind ? contentLabels[input.kind] : "Content", targetId: input.targetId, result: "FAILURE", requestId: input.context.requestId, ipHash: input.context.ipHash, userAgent: input.context.userAgent, errorCode: cmsAuditErrorCode(input.error) });
}

/** ฟังก์ชันสาธารณะ cmsSession เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export async function cmsSession() {
  const session = await currentSession();
  return session?.twoFactorAt && !session.admin.mustChangePassword && session.admin.twoFactorEnabled ? session : null;
}
/** เซสชันของ Super Admin ที่ยืนยันตัวตนครบแล้ว; ใช้กับงานที่ Editor ทำไม่ได้ */
export async function superAdminSession() {
  const session = await cmsSession();
  return session?.admin.role === "SUPER_ADMIN" ? session : null;
}
/** ฟังก์ชันสาธารณะ validMutation เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function validMutation(request: NextRequest) { return assertSameOrigin(request) && request.headers.get("content-type")?.startsWith("application/json") === true; }
const uploadErrors = new Set(["UPLOAD_NOT_AVAILABLE", "INVALID_UPLOAD_METADATA", "INVALID_FILE_SIGNATURE", "INVALID_IMAGE"]);
const prismaErrors: Record<string, { error: string; status: number }> = {
  P2025: { error: "ไม่พบรายการ", status: 404 },
  P2002: { error: "ชื่อ, slug หรือข้อมูลอ้างอิงนี้ซ้ำกับรายการเดิม", status: 409 },
  P2003: { error: "ข้อมูลอ้างอิงไม่ถูกต้องหรือรายการนี้ยังถูกใช้งานอยู่", status: 409 },
  P2014: { error: "ข้อมูลอ้างอิงไม่ถูกต้องหรือรายการนี้ยังถูกใช้งานอยู่", status: 409 },
};
const cmsErrorStatus: Partial<Record<string, number>> = { NOT_FOUND: 404, FORBIDDEN: 403 };

/** แปลงข้อผิดพลาดที่คาดไว้เป็นข้อความสำหรับผู้ใช้; คืน null ถ้าเป็นข้อผิดพลาดที่ไม่รู้จัก */
function knownCmsError(error: unknown): { error: string; status: number; fields?: unknown } | null {
  if (error instanceof SyntaxError) return { error: "ข้อมูลไม่ถูกต้อง", status: 400 };
  if (error instanceof ZodError) return { error: "ข้อมูลไม่ถูกต้อง", status: 400, fields: error.flatten().fieldErrors };
  if (error instanceof CmsError) return { error: error.message, status: cmsErrorStatus[error.code] ?? 409 };
  if (error instanceof Prisma.PrismaClientKnownRequestError) return prismaErrors[error.code] ?? null;
  if (!(error instanceof Error)) return null;
  if (error.message === "MEDIA_IN_USE") return { error: "ไฟล์นี้ยังถูกใช้งานโดยเนื้อหา จึงยังลบไม่ได้", status: 409 };
  if (uploadErrors.has(error.message)) return { error: "ไฟล์ไม่ถูกต้อง หมดเวลา หรือไม่สามารถประมวลผลได้", status: 422 };
  return null;
}

/** ตอบข้อผิดพลาดของ API หลังบ้านแบบไม่เปิดเผยรายละเอียดภายใน; ข้อผิดพลาดที่ไม่รู้จักจะบันทึก log พร้อม requestId */
export function cmsError(error: unknown, requestId?: string) {
  const known = knownCmsError(error);
  if (known) {
    const { status, ...body } = known;
    return NextResponse.json(body, { status });
  }
  const correlationId = requestId ?? randomUUID();
  log("error", "cms_request_failed", { requestId: correlationId, ...errorDetails(error) });
  return NextResponse.json({ error: "ไม่สามารถดำเนินการได้", requestId: correlationId }, { status: 500, headers: { "x-request-id": correlationId, "Cache-Control": "no-store" } });
}
