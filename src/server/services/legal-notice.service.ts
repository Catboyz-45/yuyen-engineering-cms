/**
 * หน้าที่ของไฟล์นี้: ข้อมูลที่บริษัทต้องยืนยันในหน้านโยบาย (ช่องทางรับคำร้อง ผู้ให้บริการ ระยะเวลาเก็บข้อมูล) และการรับรองประกาศใช้
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: เฉพาะ Super Admin แก้ได้ การรับรองผูกกับฉบับข้อความนโยบายในโค้ด
 * ถ้านักพัฒนาแก้ข้อความนโยบาย หน้าเว็บจะกลับเป็นฉบับร่างจนกว่าจะรับรองใหม่
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { CmsError } from "@/server/cms/errors";
import { isLegalNoticeApproved, legalRevision, type LegalNoticeRecord } from "@/lib/legal";
import { errorDetails, log } from "@/server/observability/logger";

const optionalText = (max: number) => z.string().trim().max(max).nullable().transform(value => value || null);

export const legalNoticeInputSchema = z.object({
  privacyEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).nullable().transform(value => value || null),
  serviceProviders: optionalText(2_000),
  retention: optionalText(2_000),
  approved: z.boolean(),
}).strict().superRefine((value, context) => {
  if (!value.approved) return;
  // ไม่ให้รับรองนโยบายที่ยังไม่มีช่องทางใช้สิทธิ์หรือยังอ้างข้อมูลที่บริษัทไม่ได้ยืนยัน
  const required = { privacyEmail: "ต้องระบุอีเมลรับคำร้องก่อนรับรอง", serviceProviders: "ต้องระบุผู้ให้บริการก่อนรับรอง", retention: "ต้องระบุระยะเวลาเก็บข้อมูลก่อนรับรอง" } as const;
  for (const [path, message] of Object.entries(required)) {
    if (!value[path as keyof typeof required]) context.addIssue({ code: "custom", path: [path], message });
  }
});

type SaveContext = { requestId?: string; ipHash?: string; userAgent?: string | null };
const adminInclude = { approvedBy: { select: { displayName: true } } } as const;

type NoticeFields = { privacyEmail: string | null; serviceProviders: string | null; retention: string | null };

function sameFields(current: NoticeFields | null, next: NoticeFields) {
  return current !== null && next.privacyEmail === current.privacyEmail && next.serviceProviders === current.serviceProviders && next.retention === current.retention;
}
/** ค่าการรับรองที่จะบันทึก: ไม่ติ๊ก = ถอนการรับรอง, ติ๊กโดยไม่แก้อะไร = คงวันที่เดิม ({}), นอกนั้น = รับรองใหม่ */
function approvalFields(approved: boolean, keepExisting: boolean, actorId: string) {
  if (!approved) return { approvedAt: null, approvedRevision: null, approvedById: null };
  if (keepExisting) return {};
  return { approvedAt: new Date(), approvedRevision: legalRevision, approvedById: actorId };
}
function approvalAction(wasApproved: boolean, nowApproved: boolean) {
  if (nowApproved && !wasApproved) return "LEGAL_NOTICE_APPROVED";
  if (wasApproved && !nowApproved) return "LEGAL_NOTICE_WITHDRAWN";
  return "LEGAL_NOTICE_UPDATED";
}
function expectedVersion(value: string | null) {
  const expected = value ? new Date(value) : null;
  if (!expected || Number.isNaN(expected.getTime())) throw new CmsError("CONFLICT", "ไม่พบเวอร์ชันข้อมูล กรุณาโหลดหน้าใหม่ก่อนบันทึก");
  return expected;
}

export class LegalNoticeService {
  /**
   * บันทึกแถวเดียวของระบบและกันการเขียนทับเมื่อ Super Admin คนอื่นแก้ก่อน
   * ติ๊กรับรองโดยไม่เปลี่ยนข้อมูล = คงวันที่รับรองเดิม; แก้ข้อมูลหรือข้อความในโค้ดเปลี่ยนฉบับ = บันทึกการรับรองใหม่
   */
  async save(input: unknown, options: { actorId: string; expectedUpdatedAt: string | null; context: SaveContext }) {
    const { approved, ...data } = legalNoticeInputSchema.parse(input);
    return db.$transaction(async tx => {
      const current = await tx.legalNotice.findUnique({ where: { singletonKey: "PRIMARY" } });
      const wasApproved = isLegalNoticeApproved(current);
      const approval = approvalFields(approved, wasApproved && sameFields(current, data), options.actorId);
      let id: string;
      if (current) {
        const expected = expectedVersion(options.expectedUpdatedAt);
        const updated = await tx.legalNotice.updateMany({ where: { id: current.id, updatedAt: expected }, data: { ...data, ...approval } });
        if (updated.count !== 1) throw new CmsError("CONFLICT", "ข้อมูลถูกแก้ไขโดยผู้ดูแลคนอื่นแล้ว กรุณาโหลดหน้าใหม่และตรวจสอบข้อมูลก่อนบันทึก");
        id = current.id;
      } else {
        id = (await tx.legalNotice.create({ data: { ...data, ...approval, singletonKey: "PRIMARY" }, select: { id: true } })).id;
      }
      const record = await tx.legalNotice.findUniqueOrThrow({ where: { id }, include: adminInclude });
      const action = approvalAction(wasApproved, isLegalNoticeApproved(record));
      const ipHash = options.context.ipHash ? { ipHash: options.context.ipHash } : {};
      await tx.auditLog.create({ data: { actorId: options.actorId, action, targetType: "LegalNotice", targetId: record.id, result: "SUCCESS", requestId: options.context.requestId, userAgent: options.context.userAgent, metadata: { revision: legalRevision, ...ipHash } } });
      return record;
    });
  }

  /** ข้อมูลสำหรับฟอร์มหลังบ้าน พร้อมฉบับข้อความปัจจุบันเพื่อบอกว่าการรับรองเดิมยังมีผลหรือไม่ */
  async findForAdmin() {
    const notice = await db.legalNotice.findUnique({ where: { singletonKey: "PRIMARY" }, include: adminInclude });
    return { notice, revision: legalRevision, approved: isLegalNoticeApproved(notice) };
  }
}

export type PublicLegalNotice = { approved: boolean; approvedAt: string | null; privacyEmail: string | null; serviceProviders: string | null; retention: string | null };
const draftNotice: PublicLegalNotice = { approved: false, approvedAt: null, privacyEmail: null, serviceProviders: null, retention: null };

const cachedNotice = unstable_cache(async (): Promise<LegalNoticeRecord | null> => {
  const notice = await db.legalNotice.findUnique({ where: { singletonKey: "PRIMARY" }, select: { privacyEmail: true, serviceProviders: true, retention: true, approvedAt: true, approvedRevision: true } });
  return notice && { ...notice, approvedAt: notice.approvedAt?.toISOString() ?? null };
}, ["public-legal-notice"], { tags: ["public-content", "legal"], revalidate: 3600 });

/**
 * ข้อมูลนโยบายสำหรับหน้าเว็บ: ฐานข้อมูลขัดข้องจะแสดงเป็นฉบับร่าง (ไม่ index) แทนการทำให้หน้านโยบายเปิดไม่ได้
 * ข้อมูลที่บริษัทกรอกแสดงได้ตั้งแต่ยังไม่รับรอง เพื่อให้ตรวจทานบนหน้าจริงก่อนกดรับรอง
 */
export async function getPublicLegalNotice(): Promise<PublicLegalNotice> {
  try {
    const notice = await cachedNotice();
    if (!notice) return draftNotice;
    const approved = isLegalNoticeApproved(notice);
    return { approved, approvedAt: approved ? String(notice.approvedAt) : null, privacyEmail: notice.privacyEmail, serviceProviders: notice.serviceProviders, retention: notice.retention };
  } catch (error) {
    log("error", "legal_notice_unavailable", errorDetails(error));
    return draftNotice;
  }
}
