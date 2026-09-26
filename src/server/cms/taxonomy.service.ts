/**
 * หน้าที่ของไฟล์นี้: ชั้น service taxonomy.service รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { Prisma, type AdminRole } from "@prisma/client";
import { db } from "@/server/db";
import { serializable } from "@/server/db/transaction";
import { CmsError } from "./errors";
import { taxonomySchema, type TaxonomyKind } from "./schemas";
import { retentionDate } from "./rules";

type Actor = { id: string; role: AdminRole };
type Context = { requestId?: string; ipHash?: string; userAgent?: string | null };
const labels: Record<TaxonomyKind, string> = {
  brands: "Brand",
  "product-types": "ProductType",
  "news-categories": "NewsCategory",
};
function audit(
  actor: Actor,
  kind: TaxonomyKind,
  id: string,
  action: string,
  context: Context,
): Prisma.AuditLogCreateInput {
  return {
    actor: { connect: { id: actor.id } },
    action,
    targetType: labels[kind],
    targetId: id,
    result: "SUCCESS",
    requestId: context.requestId,
    userAgent: context.userAgent,
    metadata: context.ipHash ? { ipHash: context.ipHash } : undefined,
  };
}

type TaxonomyData = ReturnType<typeof taxonomySchema.parse>;
type TaxonomyState = { deletedAt: Date | null; purgeAt: Date | null; isActive: boolean };

function createTaxonomy(tx: Prisma.TransactionClient, kind: TaxonomyKind, data: TaxonomyData) {
  switch (kind) {
    case "brands":
      return tx.brand.create({ data });
    case "product-types":
      return tx.productType.create({ data });
    default:
      return tx.newsCategory.create({ data });
  }
}
function updateTaxonomy(
  tx: Prisma.TransactionClient,
  kind: TaxonomyKind,
  id: string,
  data: TaxonomyData | TaxonomyState,
) {
  switch (kind) {
    case "brands":
      return tx.brand.update({ where: { id }, data });
    case "product-types":
      return tx.productType.update({ where: { id }, data });
    default:
      return tx.newsCategory.update({ where: { id }, data });
  }
}
function deleteTaxonomy(tx: Prisma.TransactionClient, kind: TaxonomyKind, id: string) {
  switch (kind) {
    case "brands":
      return tx.brand.delete({ where: { id } });
    case "product-types":
      return tx.productType.delete({ where: { id } });
    default:
      return tx.newsCategory.delete({ where: { id } });
  }
}
/** จำนวนสินค้าหรือข่าวที่ยังอ้างถึงรายการนี้ (รวมที่อยู่ในถังขยะ เพราะยังกู้คืนได้) */
function usageCount(tx: Prisma.TransactionClient, kind: TaxonomyKind, id: string) {
  switch (kind) {
    case "brands":
      return tx.product.count({ where: { brandId: id } });
    case "product-types":
      return tx.product.count({ where: { productTypeId: id } });
    default:
      return tx.news.count({ where: { categoryId: id } });
  }
}

export class TaxonomyService {
  list(kind: TaxonomyKind) {
    const orderBy = [{ sortOrder: "asc" as const }, { name: "asc" as const }];
    switch (kind) {
      case "brands":
        return db.brand.findMany({
          where: { deletedAt: null },
          include: { _count: { select: { products: true } } },
          orderBy,
        });
      case "product-types":
        return db.productType.findMany({
          where: { deletedAt: null },
          include: { _count: { select: { products: true } } },
          orderBy,
        });
      default:
        return db.newsCategory.findMany({
          where: { deletedAt: null },
          include: { _count: { select: { news: true } } },
          orderBy,
        });
    }
  }
  create(kind: TaxonomyKind, input: unknown, actor: Actor, context: Context) {
    const data = taxonomySchema.parse(input);
    return serializable(async tx => {
      const record = await createTaxonomy(tx, kind, data);
      await tx.auditLog.create({ data: audit(actor, kind, record.id, "TAXONOMY_CREATED", context) });
      return record;
    });
  }
  update(kind: TaxonomyKind, id: string, input: unknown, actor: Actor, context: Context) {
    const data = taxonomySchema.parse(input);
    return serializable(async tx => {
      const record = await updateTaxonomy(tx, kind, id, data);
      await tx.auditLog.create({ data: audit(actor, kind, id, "TAXONOMY_UPDATED", context) });
      return record;
    });
  }
  remove(kind: TaxonomyKind, id: string, actor: Actor, context: Context) {
    return serializable(async tx => {
      if (await usageCount(tx, kind, id)) throw new CmsError("IN_USE", "รายการนี้ยังถูกใช้งานอยู่");
      await updateTaxonomy(tx, kind, id, { deletedAt: new Date(), purgeAt: retentionDate(), isActive: false });
      await tx.auditLog.create({ data: audit(actor, kind, id, "TAXONOMY_TRASHED", context) });
    });
  }
  transition(kind: TaxonomyKind, id: string, action: "restore" | "delete", actor: Actor, context: Context) {
    if (action === "delete" && actor.role !== "SUPER_ADMIN")
      throw new CmsError("FORBIDDEN", "เฉพาะ Super Admin เท่านั้น");
    return serializable(async tx => {
      if (await usageCount(tx, kind, id)) throw new CmsError("IN_USE", "รายการนี้ยังถูกใช้งานอยู่");
      if (action === "restore") {
        await updateTaxonomy(tx, kind, id, { deletedAt: null, purgeAt: null, isActive: true });
        await tx.auditLog.create({ data: audit(actor, kind, id, "TAXONOMY_RESTORED", context) });
      } else {
        await deleteTaxonomy(tx, kind, id);
        await tx.auditLog.create({ data: audit(actor, kind, id, "TAXONOMY_DELETED_PERMANENTLY", context) });
      }
    });
  }
}
