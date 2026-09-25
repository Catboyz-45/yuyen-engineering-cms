/**
 * หน้าที่ของไฟล์นี้: API /api/admin/legal รองรับ GET, PATCH สำหรับข้อมูลที่บริษัทยืนยันในหน้านโยบายและการรับรองประกาศใช้
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: เฉพาะ Super Admin ที่ยืนยันตัวตนสองขั้นตอนแล้วเท่านั้น
 */
import { NextRequest, NextResponse } from "next/server";
import { LegalNoticeService } from "@/server/services/legal-notice.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";

const service = new LegalNoticeService();

async function superAdminSession() {
  const session = await cmsSession();
  return session?.admin.role === "SUPER_ADMIN" ? session : null;
}

/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลนโยบายและสถานะการรับรองโดยไม่แก้ไขข้อมูล */
export async function GET() {
  if (!(await superAdminSession())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await service.findForAdmin(), { headers: { "Cache-Control": "no-store" } });
}

/** จุดเริ่มของคำขอ HTTP PATCH: บันทึกข้อมูลนโยบาย รับรอง หรือยกเลิกการรับรอง แล้วล้าง cache หน้าเว็บทันที */
export async function PATCH(request: NextRequest) {
  const session = await superAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const context = requestContext(request);
  try {
    const notice = await service.save(await request.json(), { actorId: session.adminId, expectedUpdatedAt: request.headers.get("if-unmodified-since"), context });
    invalidatePublicContent();
    return NextResponse.json(await service.findForAdmin().then(result => ({ ...result, notice })));
  } catch (error) {
    return cmsError(error, context.requestId);
  }
}
