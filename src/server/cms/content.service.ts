/**
 * หน้าที่ของไฟล์นี้: ชั้น service content.service รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { ContentStatus, Prisma, type AdminRole } from "@prisma/client";
import { db } from "@/server/db";
import { serializable } from "@/server/db/transaction";
import { CmsError } from "./errors";
import {
  bannerSchema,
  listQuerySchema,
  newsSchema,
  productSchema,
  projectSchema,
  serviceSchema,
  type ContentKind,
} from "./schemas";
import { canTransition, newsPublicationDate, retentionDate } from "./rules";

type Actor = { id: string; role: AdminRole };
type AuditContext = { requestId?: string; ipHash?: string; userAgent?: string | null };
const paths: Partial<Record<ContentKind, string>> = {
  services: "/services",
  products: "/products",
  projects: "/projects",
  news: "/news",
};
const labels: Record<ContentKind, string> = {
  banners: "Banner",
  services: "Service",
  products: "Product",
  projects: "Project",
  news: "News",
};

function publishedAt(status: "DRAFT" | "PUBLISHED", requested?: Date | null) {
  return status === "PUBLISHED" ? (requested ?? new Date()) : null;
}
function auditData(
  actor: Actor,
  action: string,
  kind: ContentKind,
  targetId: string,
  context: AuditContext,
  metadata?: Prisma.InputJsonObject,
): Prisma.AuditLogCreateInput {
  return {
    actor: { connect: { id: actor.id } },
    action,
    targetType: labels[kind],
    targetId,
    result: "SUCCESS",
    requestId: context.requestId,
    userAgent: context.userAgent,
    metadata: { ...metadata, ...(context.ipHash ? { ipHash: context.ipHash } : {}) },
  };
}
function orderBy(sort: string, titleField: "title" | "name" = "title") {
  if (sort === "updated-asc") return [{ updatedAt: "asc" as const }];
  if (sort === "title-asc") return [{ [titleField]: "asc" as const }];
  if (sort === "title-desc") return [{ [titleField]: "desc" as const }];
  return [{ updatedAt: "desc" as const }];
}
/** ตรวจว่าไฟล์พร้อมใช้และถูกชนิด แล้วยกเลิกกำหนดลบไฟล์กำพร้า ใช้ร่วมกับข้อมูลบริษัทด้วย */
export async function assertMedia(
  tx: Prisma.TransactionClient,
  images: Array<string | null | undefined>,
  pdfs: Array<string | null | undefined> = [],
) {
  const imageIds = [...new Set(images.filter((id): id is string => Boolean(id)))];
  const pdfIds = [...new Set(pdfs.filter((id): id is string => Boolean(id)))];
  const [imageCount, pdfCount] = await Promise.all([
    tx.media.count({ where: { id: { in: imageIds }, kind: "IMAGE", status: "READY", deletedAt: null } }),
    tx.media.count({ where: { id: { in: pdfIds }, kind: "PDF", status: "READY", deletedAt: null } }),
  ]);
  if (imageCount !== imageIds.length || pdfCount !== pdfIds.length)
    throw new CmsError("INVALID_MEDIA", "ไฟล์สื่อไม่พร้อมใช้งานหรือชนิดไฟล์ไม่ถูกต้อง");
  const mediaIds = [...imageIds, ...pdfIds];
  if (mediaIds.length) await tx.media.updateMany({ where: { id: { in: mediaIds } }, data: { orphanExpiresAt: null } });
}

type ListQuery = ReturnType<typeof listQuerySchema.parse>;
type ListRow = {
  id: string;
  slug?: string;
  title: string;
  status: ContentStatus;
  updatedAt: Date;
  publishedAt?: Date | null;
};
type ListPage = { skip: number; take: number };
type TextMatch = { contains: string; mode: "insensitive" };
type EditableRow = { status: ContentStatus; publishedAt: Date | null };
type SavedRecord = { record: { id: string }; slug?: string; status: ContentStatus };
type TrashAction = "trash" | "restore" | "delete";

const actionTarget: Record<"publish" | "unpublish" | "archive", ContentStatus> = {
  publish: ContentStatus.PUBLISHED,
  unpublish: ContentStatus.DRAFT,
  archive: ContentStatus.ARCHIVED,
};

/** เงื่อนไขค้นหาแบบไม่สนตัวพิมพ์เล็กใหญ่ในหลายช่อง; ไม่มีคำค้นก็ไม่กรอง */
function textFilter<T>(query: string, fields: (match: TextMatch) => T[]): { OR?: T[] } {
  if (!query) return {};
  return { OR: fields({ contains: query, mode: "insensitive" }) };
}
function isTrashAction(action: string): action is TrashAction {
  return action === "trash" || action === "restore" || action === "delete";
}
/** วันเผยแพร่หลังเปลี่ยนสถานะ: เผยแพร่ใช้วันเดิมหรือวันนี้, ฉบับร่างล้างวัน, เก็บถาวรคงวันเดิม */
function statusDate(target: ContentStatus, previous: Date | null) {
  if (target === ContentStatus.PUBLISHED) return previous ?? new Date();
  if (target === ContentStatus.DRAFT) return null;
  return previous;
}
/** แก้ไขรายการที่เก็บถาวรให้กลับไปเผยแพร่ตรง ๆ ไม่ได้ ต้องกู้เป็นฉบับร่างก่อน */
function assertEditable(current: ContentStatus, next: ContentStatus) {
  if (!canTransition(current, next))
    throw new CmsError("INVALID_TRANSITION", "ต้องกู้รายการเก็บถาวรเป็นฉบับร่างก่อนเผยแพร่");
}
function changedSlug(previous: string | null | undefined, next: string | undefined) {
  return previous && next && previous !== next ? { previous, next } : null;
}
/**
 * ไฟล์ที่แนบกับเนื้อหาในหน้าแก้ไข ส่งเฉพาะช่องที่ฟอร์มใช้ ไม่ส่ง object key ของ storage และ sizeBytes
 * (BigInt แปลงเป็น JSON ไม่ได้ ทำให้หน้าแก้ไขเนื้อหาที่มีรูปโหลดไม่ขึ้น)
 */
const adminMedia = { select: { id: true, originalName: true, kind: true, altText: true } } as const;

function galleryRows(mediaIds: string[]) {
  return { create: mediaIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder })) };
}

export class ContentService {
  async list(kind: ContentKind, rawQuery: unknown) {
    const query = listQuerySchema.parse(rawQuery);
    const page = { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
    const [items, total] = await this.listRows(kind, query, page);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async get(kind: ContentKind, idOrSlug: string, includeDeleted = false) {
    const visible = includeDeleted ? {} : { deletedAt: null };
    const where = { OR: [{ id: idOrSlug }, { slug: idOrSlug }], ...visible };
    switch (kind) {
      case "banners":
        return db.banner.findFirst({ where: { id: idOrSlug, ...visible }, include: { image: adminMedia } });
      case "services":
        return db.service.findFirst({ where, include: { coverMedia: adminMedia } });
      case "products":
        return db.product.findFirst({
          where,
          include: {
            coverMedia: adminMedia,
            catalogMedia: adminMedia,
            gallery: { orderBy: { sortOrder: "asc" }, include: { media: adminMedia } },
            brand: true,
            productType: true,
          },
        });
      case "projects":
        return db.project.findFirst({
          where,
          include: {
            coverMedia: adminMedia,
            gallery: { orderBy: { sortOrder: "asc" }, include: { media: adminMedia } },
            services: true,
          },
        });
      default:
        return db.news.findFirst({ where, include: { coverMedia: adminMedia, category: true } });
    }
  }

  async create(kind: ContentKind, input: unknown, actor: Actor, context: AuditContext) {
    return serializable(async tx => {
      const record = await this.createRecord(tx, kind, input);
      await tx.auditLog.create({ data: auditData(actor, "CONTENT_CREATED", kind, record.id, context) });
      return record;
    });
  }

  async update(
    kind: ContentKind,
    id: string,
    input: unknown,
    actor: Actor,
    context: AuditContext,
    expectedUpdatedAt?: string | null,
  ) {
    return serializable(async tx => {
      const current = await this.findForUpdate(tx, kind, id);
      if (!current || current.deletedAt) throw new CmsError("NOT_FOUND", "ไม่พบรายการ");
      if (expectedUpdatedAt && current.updatedAt.toISOString() !== expectedUpdatedAt)
        throw new CmsError("CONFLICT", "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก");
      const saved = await this.updateRecord(tx, kind, id, input, current);
      const moved = changedSlug(current.slug, saved.slug);
      const prefix = paths[kind];
      // ลิงก์เดิมของรายการที่เผยแพร่แล้วต้องพาไปหน้าใหม่ ไม่ให้ลิงก์ที่แชร์ไว้เสีย
      if (moved && prefix && current.status === ContentStatus.PUBLISHED) {
        await tx.redirect.upsert({
          where: { fromPath: `${prefix}/${moved.previous}` },
          create: { fromPath: `${prefix}/${moved.previous}`, toPath: `${prefix}/${moved.next}`, statusCode: 301 },
          update: { toPath: `${prefix}/${moved.next}`, statusCode: 301, isActive: true },
        });
      }
      const action = current.status === saved.status ? "CONTENT_UPDATED" : `CONTENT_${saved.status}`;
      await tx.auditLog.create({
        data: auditData(actor, action, kind, id, context, {
          slugChanged: Boolean(moved),
          previousStatus: current.status,
        }),
      });
      return saved.record;
    });
  }

  async transition(
    kind: ContentKind,
    id: string,
    action: "publish" | "unpublish" | "archive" | "trash" | "restore" | "delete",
    actor: Actor,
    context: AuditContext,
  ) {
    if (action === "delete" && actor.role !== "SUPER_ADMIN")
      throw new CmsError("FORBIDDEN", "เฉพาะ Super Admin เท่านั้น");
    return serializable(async tx => {
      const current = await this.findForUpdate(tx, kind, id);
      if (!current) throw new CmsError("NOT_FOUND", "ไม่พบรายการ");
      if (isTrashAction(action)) return this.trashTransition(tx, kind, id, action, current, actor, context);
      if (current.deletedAt) throw new CmsError("INVALID_TRANSITION", "ไม่สามารถเปลี่ยนสถานะรายการในถังขยะ");
      const target = actionTarget[action];
      if (!canTransition(current.status, target))
        throw new CmsError("INVALID_TRANSITION", "ไม่อนุญาตให้เปลี่ยนสถานะตามลำดับนี้");
      await this.setStatus(tx, kind, id, target, statusDate(target, current.publishedAt));
      await tx.auditLog.create({ data: auditData(actor, `CONTENT_${target}`, kind, id, context) });
      return { status: target };
    });
  }

  private listRows(kind: ContentKind, query: ListQuery, page: ListPage): Promise<[ListRow[], number]> {
    const base = { deletedAt: null, ...(query.status === "ALL" ? {} : { status: query.status as ContentStatus }) };
    const order = orderBy(query.sort);
    switch (kind) {
      case "banners": {
        const where: Prisma.BannerWhereInput = { ...base, ...textFilter(query.query, match => [{ title: match }]) };
        return db.$transaction([
          db.banner.findMany({
            where,
            select: { id: true, title: true, status: true, updatedAt: true },
            ...page,
            orderBy: order,
          }),
          db.banner.count({ where }),
        ]);
      }
      case "services": {
        const where: Prisma.ServiceWhereInput = {
          ...base,
          ...textFilter(query.query, match => [{ title: match }, { summary: match }]),
        };
        return db.$transaction([
          db.service.findMany({
            where,
            select: { id: true, slug: true, title: true, status: true, updatedAt: true },
            ...page,
            orderBy: order,
          }),
          db.service.count({ where }),
        ]);
      }
      case "products":
        return this.listProducts(query, base, page);
      case "projects": {
        const where: Prisma.ProjectWhereInput = {
          ...base,
          ...textFilter(query.query, match => [{ title: match }, { area: match }]),
        };
        return db.$transaction([
          db.project.findMany({
            where,
            select: { id: true, slug: true, title: true, status: true, updatedAt: true },
            ...page,
            orderBy: order,
          }),
          db.project.count({ where }),
        ]);
      }
      default: {
        const where: Prisma.NewsWhereInput = {
          ...base,
          ...textFilter(query.query, match => [{ title: match }, { summary: match }]),
        };
        return db.$transaction([
          db.news.findMany({
            where,
            select: { id: true, slug: true, title: true, status: true, updatedAt: true, publishedAt: true },
            ...page,
            orderBy: order,
          }),
          db.news.count({ where }),
        ]);
      }
    }
  }

  private async listProducts(
    query: ListQuery,
    base: Prisma.ProductWhereInput,
    page: ListPage,
  ): Promise<[ListRow[], number]> {
    const where: Prisma.ProductWhereInput = {
      ...base,
      ...textFilter(query.query, match => [{ name: match }, { model: match }]),
    };
    const [rows, total] = await db.$transaction([
      db.product.findMany({
        where,
        select: { id: true, slug: true, name: true, model: true, status: true, updatedAt: true },
        ...page,
        orderBy: orderBy(query.sort, "name"),
      }),
      db.product.count({ where }),
    ]);
    return [rows.map(item => ({ ...item, title: item.name })), total];
  }

  private async createRecord(tx: Prisma.TransactionClient, kind: ContentKind, input: unknown) {
    switch (kind) {
      case "banners": {
        const data = bannerSchema.parse(input);
        await assertMedia(tx, [data.imageId]);
        return tx.banner.create({ data: { ...data, publishedAt: publishedAt(data.status) } });
      }
      case "services": {
        const data = serviceSchema.parse(input);
        await assertMedia(tx, [data.coverMediaId]);
        return tx.service.create({ data: { ...data, publishedAt: publishedAt(data.status) } });
      }
      case "products": {
        const data = productSchema.parse(input);
        await assertMedia(tx, [data.coverMediaId, ...data.galleryMediaIds], [data.catalogMediaId]);
        const { galleryMediaIds, specifications, ...values } = data;
        return tx.product.create({
          data: {
            ...values,
            specifications: specifications ?? Prisma.JsonNull,
            publishedAt: publishedAt(data.status),
            gallery: galleryRows(galleryMediaIds),
          },
        });
      }
      case "projects": {
        const data = projectSchema.parse(input);
        await assertMedia(tx, [data.coverMediaId, ...data.galleryMediaIds]);
        const { galleryMediaIds, serviceIds, ...values } = data;
        return tx.project.create({
          data: {
            ...values,
            publishedAt: publishedAt(data.status),
            gallery: galleryRows(galleryMediaIds),
            services: { create: serviceIds.map(serviceId => ({ serviceId })) },
          },
        });
      }
      default: {
        const data = newsSchema.parse(input);
        await assertMedia(tx, [data.coverMediaId]);
        return tx.news.create({ data: { ...data, publishedAt: newsPublicationDate(data.publishedAt, data.status) } });
      }
    }
  }

  private async updateRecord(
    tx: Prisma.TransactionClient,
    kind: ContentKind,
    id: string,
    input: unknown,
    current: EditableRow,
  ): Promise<SavedRecord> {
    switch (kind) {
      case "banners": {
        const data = bannerSchema.parse(input);
        await assertMedia(tx, [data.imageId]);
        assertEditable(current.status, data.status);
        const record = await tx.banner.update({
          where: { id },
          data: { ...data, publishedAt: publishedAt(data.status, current.publishedAt) },
        });
        return { record, status: data.status };
      }
      case "services": {
        const data = serviceSchema.parse(input);
        await assertMedia(tx, [data.coverMediaId]);
        assertEditable(current.status, data.status);
        const record = await tx.service.update({
          where: { id },
          data: { ...data, publishedAt: publishedAt(data.status, current.publishedAt) },
        });
        return { record, slug: data.slug, status: data.status };
      }
      case "products": {
        const data = productSchema.parse(input);
        await assertMedia(tx, [data.coverMediaId, ...data.galleryMediaIds], [data.catalogMediaId]);
        assertEditable(current.status, data.status);
        const { galleryMediaIds, specifications, ...values } = data;
        await tx.productMedia.deleteMany({ where: { productId: id } });
        const record = await tx.product.update({
          where: { id },
          data: {
            ...values,
            specifications: specifications ?? Prisma.JsonNull,
            publishedAt: publishedAt(data.status, current.publishedAt),
            gallery: galleryRows(galleryMediaIds),
          },
        });
        return { record, slug: data.slug, status: data.status };
      }
      case "projects": {
        const data = projectSchema.parse(input);
        await assertMedia(tx, [data.coverMediaId, ...data.galleryMediaIds]);
        assertEditable(current.status, data.status);
        const { galleryMediaIds, serviceIds, ...values } = data;
        await tx.projectMedia.deleteMany({ where: { projectId: id } });
        await tx.projectService.deleteMany({ where: { projectId: id } });
        const record = await tx.project.update({
          where: { id },
          data: {
            ...values,
            publishedAt: publishedAt(data.status, current.publishedAt),
            gallery: galleryRows(galleryMediaIds),
            services: { create: serviceIds.map(serviceId => ({ serviceId })) },
          },
        });
        return { record, slug: data.slug, status: data.status };
      }
      default: {
        const data = newsSchema.parse(input);
        await assertMedia(tx, [data.coverMediaId]);
        assertEditable(current.status, data.status);
        const record = await tx.news.update({
          where: { id },
          data: { ...data, publishedAt: newsPublicationDate(data.publishedAt, data.status, current.publishedAt) },
        });
        return { record, slug: data.slug, status: data.status };
      }
    }
  }

  /** ย้ายลงถังขยะ กู้คืน หรือลบถาวร (ลบถาวรได้เฉพาะรายการที่อยู่ในถังขยะแล้ว) */
  private async trashTransition(
    tx: Prisma.TransactionClient,
    kind: ContentKind,
    id: string,
    action: TrashAction,
    current: { status: ContentStatus; deletedAt: Date | null },
    actor: Actor,
    context: AuditContext,
  ) {
    switch (action) {
      case "delete":
        if (!current.deletedAt) throw new CmsError("INVALID_TRANSITION", "ต้องย้ายรายการไปถังขยะก่อน");
        await this.remove(tx, kind, id);
        await tx.auditLog.create({ data: auditData(actor, "CONTENT_DELETED_PERMANENTLY", kind, id, context) });
        return { deleted: true };
      case "trash":
        if (current.deletedAt) throw new CmsError("INVALID_TRANSITION", "รายการอยู่ในถังขยะแล้ว");
        await this.softDelete(tx, kind, id);
        await tx.auditLog.create({ data: auditData(actor, "CONTENT_TRASHED", kind, id, context) });
        return { status: current.status };
      default:
        if (!current.deletedAt) throw new CmsError("INVALID_TRANSITION", "รายการไม่ได้อยู่ในถังขยะ");
        await this.restore(tx, kind, id);
        await tx.auditLog.create({ data: auditData(actor, "CONTENT_RESTORED", kind, id, context) });
        return { status: ContentStatus.DRAFT };
    }
  }

  private findForUpdate(tx: Prisma.TransactionClient, kind: ContentKind, id: string) {
    const select = { id: true, status: true, slug: true, publishedAt: true, deletedAt: true, updatedAt: true };
    if (kind === "banners")
      return tx.banner
        .findUnique({
          where: { id },
          select: { id: true, status: true, publishedAt: true, deletedAt: true, updatedAt: true },
        })
        .then(row => row && { ...row, slug: null });
    if (kind === "services") return tx.service.findUnique({ where: { id }, select });
    if (kind === "products") return tx.product.findUnique({ where: { id }, select });
    if (kind === "projects") return tx.project.findUnique({ where: { id }, select });
    return tx.news.findUnique({ where: { id }, select });
  }
  private setStatus(
    tx: Prisma.TransactionClient,
    kind: ContentKind,
    id: string,
    status: ContentStatus,
    date: Date | null,
  ) {
    const data = { status, publishedAt: date };
    if (kind === "banners") return tx.banner.update({ where: { id }, data });
    if (kind === "services") return tx.service.update({ where: { id }, data });
    if (kind === "products") return tx.product.update({ where: { id }, data });
    if (kind === "projects") return tx.project.update({ where: { id }, data });
    return tx.news.update({ where: { id }, data });
  }
  private softDelete(tx: Prisma.TransactionClient, kind: ContentKind, id: string) {
    const data = { deletedAt: new Date(), purgeAt: retentionDate() };
    if (kind === "banners") return tx.banner.update({ where: { id }, data });
    if (kind === "services") return tx.service.update({ where: { id }, data });
    if (kind === "products") return tx.product.update({ where: { id }, data });
    if (kind === "projects") return tx.project.update({ where: { id }, data });
    return tx.news.update({ where: { id }, data });
  }
  private restore(tx: Prisma.TransactionClient, kind: ContentKind, id: string) {
    const data = { deletedAt: null, purgeAt: null, status: ContentStatus.DRAFT, publishedAt: null };
    if (kind === "banners") return tx.banner.update({ where: { id }, data });
    if (kind === "services") return tx.service.update({ where: { id }, data });
    if (kind === "products") return tx.product.update({ where: { id }, data });
    if (kind === "projects") return tx.project.update({ where: { id }, data });
    return tx.news.update({ where: { id }, data });
  }
  private remove(tx: Prisma.TransactionClient, kind: ContentKind, id: string) {
    if (kind === "banners") return tx.banner.delete({ where: { id } });
    if (kind === "services") return tx.service.delete({ where: { id } });
    if (kind === "products") return tx.product.delete({ where: { id } });
    if (kind === "projects") return tx.project.delete({ where: { id } });
    return tx.news.delete({ where: { id } });
  }
}
