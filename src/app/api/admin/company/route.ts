/**
 * หน้าที่ของไฟล์นี้: API /api/admin/company รองรับ GET, PATCH; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { CompanyService } from "@/server/services/company.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";

const service = new CompanyService();
/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET() { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const company = await service.findForAdmin(); return NextResponse.json({ company }, { headers: { "Cache-Control": "no-store" } }); }
/** จุดเริ่มของคำขอ HTTP PATCH: สร้างข้อมูลบริษัทครั้งแรกหรือแก้ไขฉบับล่าสุด และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function PATCH(request: NextRequest) {
  const session = await cmsSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const context = requestContext(request);
  try {
    const company = await service.save(await request.json(), { actorId: session.adminId, expectedUpdatedAt: request.headers.get("if-unmodified-since"), context });
    invalidatePublicContent();
    return NextResponse.json({ company });
  } catch (error) {
    return cmsError(error, context.requestId);
  }
}
