/**
 * หน้าที่ของไฟล์นี้: ชั้น service company.service รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { z } from "zod";
import { safeMapEmbedUrl } from "@/lib/map-embed";
import { db } from "@/server/db";
import { CmsError } from "@/server/cms/errors";
import { assertMedia } from "@/server/cms/content.service";

const optionalUrl = z.union([z.literal(""), z.string().url()]).transform((value) => value || null);
export const COMPANY_GALLERY_LIMIT = 12;

export const companyInputSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(160),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  history: z.string().trim().max(20_000).nullable().optional(),
  vision: z.string().trim().max(10_000).nullable().optional(),
  mission: z.string().trim().max(10_000).nullable().optional(),
  values: z.string().trim().max(10_000).nullable().optional(),
  address: z.string().trim().max(2_000).nullable().optional(),
  phoneDisplay: z.string().trim().max(50).nullable().optional(),
  phoneHref: z.string().trim().max(30).regex(/^\+?[0-9]{8,15}$/).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  lineLabel: z.string().trim().max(100).nullable().optional(),
  lineUrl: optionalUrl.nullable().optional(),
  facebookUrl: optionalUrl.nullable().optional(),
  mapsUrl: optionalUrl.nullable().optional(),
  // ปฏิเสธ URL ภายนอกที่ไม่ใช่ Google Maps embed ตั้งแต่จุดบันทึกฝั่งเซิร์ฟเวอร์
  mapsEmbedUrl: optionalUrl.refine(value => value === null || safeMapEmbedUrl(value) !== null, "กรุณาใช้ HTTPS Google Maps embed URL").nullable().optional(),
  businessHours: z.string().trim().max(200).nullable().optional(),
  seoTitle: z.string().trim().max(60).nullable().optional(),
  seoDescription: z.string().trim().max(160).nullable().optional(),
  logoMediaId: z.string().trim().max(30).nullable().optional(),
  // ไม่ส่งมา = คงแกลเลอรีเดิม, ส่ง [] = ลบรูปบริษัทออกทั้งหมด
  galleryMediaIds: z.array(z.string().trim().min(1).max(30)).max(COMPANY_GALLERY_LIMIT)
    .refine(ids => new Set(ids).size === ids.length, "รูปภาพซ้ำกัน").optional(),
}).strict();

type SaveContext = { requestId?: string; ipHash?: string; userAgent?: string | null };

export class CompanyService {
  /**
   * บันทึกข้อมูลบริษัทแถวเดียวของระบบ: สร้างครั้งแรกได้โดยไม่ต้องมี seed และกันการเขียนทับเมื่อมีผู้ดูแลอื่นแก้ก่อน
   */
  async save(input: unknown, options: { actorId: string; expectedUpdatedAt: string | null; context: SaveContext }) {
    const { galleryMediaIds, ...data } = companyInputSchema.parse(input);
    return db.$transaction(async tx => {
      await assertMedia(tx, [data.logoMediaId, ...(galleryMediaIds ?? [])]);
      const current = await tx.company.findUnique({ where: { singletonKey: "PRIMARY" }, select: { id: true } });
      let companyId: string;
      if (!current) {
        companyId = (await tx.company.create({ data: { ...data, singletonKey: "PRIMARY" }, select: { id: true } })).id;
      } else {
        const expected = options.expectedUpdatedAt ? new Date(options.expectedUpdatedAt) : null;
        if (!expected || Number.isNaN(expected.getTime())) throw new CmsError("CONFLICT", "ไม่พบเวอร์ชันข้อมูล กรุณาโหลดหน้าใหม่ก่อนบันทึก");
        const updated = await tx.company.updateMany({ where: { id: current.id, updatedAt: expected }, data });
        if (updated.count !== 1) throw new CmsError("CONFLICT", "ข้อมูลถูกแก้ไขโดยผู้ดูแลคนอื่นแล้ว กรุณาโหลดหน้าใหม่และตรวจสอบข้อมูลก่อนบันทึก");
        companyId = current.id;
      }
      if (galleryMediaIds) {
        await tx.companyMedia.deleteMany({ where: { companyId } });
        if (galleryMediaIds.length) await tx.companyMedia.createMany({ data: galleryMediaIds.map((mediaId, sortOrder) => ({ companyId, mediaId, sortOrder })) });
      }
      const record = await tx.company.findUniqueOrThrow({ where: { id: companyId }, include: companyAdminInclude });
      await tx.auditLog.create({ data: { actorId: options.actorId, action: current ? "COMPANY_UPDATED" : "COMPANY_CREATED", targetType: "Company", targetId: record.id, result: "SUCCESS", requestId: options.context.requestId, userAgent: options.context.userAgent, metadata: options.context.ipHash ? { ipHash: options.context.ipHash } : undefined } });
      return record;
    });
  }

  /** ข้อมูลสำหรับฟอร์มหลังบ้าน รวมไฟล์โลโก้และรูปบริษัทเพื่อแสดงตัวอย่างเดิม */
  findForAdmin() {
    return db.company.findUnique({ where: { singletonKey: "PRIMARY" }, include: companyAdminInclude });
  }
}

const mediaPreviewSelect = { id: true, originalName: true, kind: true, altText: true } as const;
const companyAdminInclude = {
  logoMedia: { select: mediaPreviewSelect },
  gallery: { orderBy: { sortOrder: "asc" as const }, include: { media: { select: mediaPreviewSelect } } },
};
