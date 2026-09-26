/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบกฎของเนื้อหาทุกชนิด หมวดหมู่ และ session กับฐานข้อมูลทดสอบจริง
 * ครอบคลุมการแก้ไขทุกชนิดเนื้อหา การเปลี่ยน slug ที่ต้องสร้าง redirect การเขียนทับ และการตรวจ session ที่หมดอายุ
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ContentService } from "@/server/cms/content.service";
import { referenceCount } from "@/server/media/references";
import { TaxonomyService } from "@/server/cms/taxonomy.service";
import { createSession, getSessionByToken, revokeUserSessions, rotateSession } from "@/server/auth/session";
import type { ContentKind } from "@/server/cms/schemas";

const suite = describe.runIf(process.env.RUN_INTEGRATION === "1");
const prefix = `lifecycle-${randomUUID().slice(0, 8)}`;
const context = { requestId: `${prefix}-request`, ipHash: "integration-ip-hash", userAgent: "vitest-integration" };

suite("content, taxonomy and session lifecycle", () => {
  const content = new ContentService();
  const taxonomies = new TaxonomyService();
  const created: Array<{ kind: ContentKind; id: string }> = [];
  const adminIds: string[] = [];
  let actor = { id: "", role: "SUPER_ADMIN" as const };
  let brandId = "";
  let typeId = "";
  let categoryId = "";

  async function admin(role: "SUPER_ADMIN" | "EDITOR", suffix: string) {
    const username = `${prefix}-${suffix}`;
    const row = await db.admin.create({ data: { username, usernameNormalized: username, displayName: `Lifecycle ${suffix}`, role, passwordHash: "integration-only-not-a-login-secret", mustChangePassword: false, twoFactorEnabled: true } });
    adminIds.push(row.id);
    return row;
  }
  async function make(kind: ContentKind, input: Record<string, unknown>) {
    const record = await content.create(kind, input, actor, context);
    created.push({ kind, id: record.id });
    return record;
  }

  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL ?? "").pathname;
    if (!/(test|e2e|sandbox)/i.test(database)) throw new Error("Refusing to run against a non-test database");
    actor = { id: (await admin("SUPER_ADMIN", "owner")).id, role: "SUPER_ADMIN" };
    brandId = (await taxonomies.create("brands", { name: `${prefix} Brand`, slug: `${prefix}-brand`, sortOrder: 1, isActive: true }, actor, context)).id;
    typeId = (await taxonomies.create("product-types", { name: `${prefix} Type`, slug: `${prefix}-type`, sortOrder: 1, isActive: true }, actor, context)).id;
    categoryId = (await taxonomies.create("news-categories", { name: `${prefix} Category`, slug: `${prefix}-category`, sortOrder: 1, isActive: true }, actor, context)).id;
  });

  afterAll(async () => {
    await db.redirect.deleteMany({ where: { fromPath: { contains: prefix } } });
    // ลบย้อนลำดับที่สร้าง: ผลงานอ้างถึงบริการ จึงต้องลบผลงานก่อน
    for (const { kind, id } of created.toReversed()) {
      if (kind === "banners") await db.banner.deleteMany({ where: { id } });
      if (kind === "services") await db.service.deleteMany({ where: { id } });
      if (kind === "products") await db.product.deleteMany({ where: { id } });
      if (kind === "projects") await db.project.deleteMany({ where: { id } });
      if (kind === "news") await db.news.deleteMany({ where: { id } });
    }
    await db.media.deleteMany({ where: { objectKey: { startsWith: `media/${prefix}/` } } });
    await db.brand.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.productType.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.newsCategory.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: adminIds } } });
    await db.session.deleteMany({ where: { adminId: { in: adminIds } } });
    await db.admin.deleteMany({ where: { id: { in: adminIds } } });
    await db.$disconnect();
  });

  it("edits every content type and keeps archived items out of direct publishing", async () => {
    const banner = await make("banners", { title: `${prefix} Banner`, description: "draft", imageId: null, sortOrder: 1, status: "DRAFT" });
    await content.update("banners", banner.id, { title: `${prefix} Banner 2`, description: "draft", imageId: null, sortOrder: 2, status: "DRAFT" }, actor, context);
    expect(await content.get("banners", banner.id)).toMatchObject({ title: `${prefix} Banner 2`, sortOrder: 2 });

    const product = await make("products", { slug: `${prefix}-product`, name: `${prefix} Product`, model: "M1", summary: "summary", brandId, productTypeId: typeId, galleryMediaIds: [], status: "DRAFT" });
    await content.update("products", product.id, { slug: `${prefix}-product`, name: `${prefix} Product 2`, model: "M2", summary: "summary", brandId, productTypeId: typeId, galleryMediaIds: [], specifications: { cooling: "12000 BTU" }, status: "PUBLISHED" }, actor, context);
    expect(await content.get("products", `${prefix}-product`)).toMatchObject({ name: `${prefix} Product 2`, status: "PUBLISHED", brand: { id: brandId } });

    const service = await make("services", { slug: `${prefix}-service`, title: `${prefix} Service`, summary: "summary", coverMediaId: null, status: "DRAFT" });
    const project = await make("projects", { slug: `${prefix}-project`, title: `${prefix} Project`, projectType: "HVAC", area: "Bangkok", summary: "summary", galleryMediaIds: [], serviceIds: [service.id], status: "DRAFT" });
    await content.update("projects", project.id, { slug: `${prefix}-project`, title: `${prefix} Project 2`, projectType: "HVAC", area: "Nonthaburi", summary: "summary", galleryMediaIds: [], serviceIds: [service.id], status: "DRAFT" }, actor, context);
    expect(await content.get("projects", project.id)).toMatchObject({ area: "Nonthaburi", services: [{ serviceId: service.id }] });

    const news = await make("news", { slug: `${prefix}-news`, title: `${prefix} News`, summary: "summary", categoryId, coverMediaId: null, status: "DRAFT" });
    await content.transition("news", news.id, "archive", actor, context);
    expect(await content.get("news", news.id)).toMatchObject({ status: "ARCHIVED" });
    await expect(content.update("news", news.id, { slug: `${prefix}-news`, title: `${prefix} News`, summary: "summary", categoryId, coverMediaId: null, status: "PUBLISHED" }, actor, context)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(content.transition("news", news.id, "publish", actor, context)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await content.transition("news", news.id, "unpublish", actor, context);
    expect(await content.get("news", news.id)).toMatchObject({ status: "DRAFT", publishedAt: null });
  });

  it("loads content with images for the editor without internal storage fields", async () => {
    const images = await Promise.all([1, 2].map(n => db.media.create({ data: { kind: "IMAGE", objectKey: `media/${prefix}/image-${n}.webp`, originalName: `image-${n}.jpg`, mimeType: "image/webp", sizeBytes: BigInt(12_345), altText: `รูป ${n}`, status: "READY" } })));
    const product = await make("products", { slug: `${prefix}-with-images`, name: `${prefix} With images`, model: `${prefix}-images`, summary: "x", brandId, productTypeId: typeId, coverMediaId: images[0].id, galleryMediaIds: [images[1].id], status: "DRAFT" });
    const record = await content.get("products", product.id);
    // หน้าแก้ไขรับข้อมูลเป็น JSON: ขนาดไฟล์ BigInt เคยทำให้แปลงไม่ได้และโหลดหน้าไม่ขึ้น
    const json = JSON.parse(JSON.stringify(record));
    expect(json.coverMedia).toEqual({ id: images[0].id, originalName: "image-1.jpg", kind: "IMAGE", altText: "รูป 1" });
    expect(json.gallery.map((entry: { media: { id: string } }) => entry.media.id)).toEqual([images[1].id]);
    expect(JSON.stringify(record)).not.toContain("objectKey");

    // บริการมีแกลเลอรีเหมือนสินค้า และรูปที่อยู่ในแกลเลอรีบริการถูกนับว่ากำลังใช้งาน จึงลบไฟล์ไม่ได้
    const serviceImage = await db.media.create({ data: { kind: "IMAGE", objectKey: `media/${prefix}/image-service.webp`, originalName: "service.jpg", mimeType: "image/webp", sizeBytes: BigInt(12_345), status: "READY" } });
    const withGallery = await make("services", { slug: `${prefix}-service-gallery`, title: `${prefix} Service gallery`, summary: "x", galleryMediaIds: [serviceImage.id, images[1].id], status: "DRAFT" });
    const serviceRecord = JSON.parse(JSON.stringify(await content.get("services", withGallery.id)));
    expect(serviceRecord.gallery.map((entry: { media: { id: string } }) => entry.media.id)).toEqual([serviceImage.id, images[1].id]);
    expect(await referenceCount(serviceImage.id)).toBe(1);
    await content.update("services", withGallery.id, { slug: `${prefix}-service-gallery`, title: `${prefix} Service gallery`, summary: "x", galleryMediaIds: [], status: "DRAFT" }, actor, context);
    expect(await referenceCount(serviceImage.id)).toBe(0);
  });

  it("redirects the old address when a published slug changes", async () => {
    const news = await make("news", { slug: `${prefix}-old`, title: `${prefix} Old`, summary: "summary", categoryId, coverMediaId: null, status: "PUBLISHED" });
    await content.update("news", news.id, { slug: `${prefix}-new`, title: `${prefix} New`, summary: "summary", categoryId, coverMediaId: null, status: "PUBLISHED" }, actor, context);
    expect(await db.redirect.findUnique({ where: { fromPath: `/news/${prefix}-old` } })).toMatchObject({ toPath: `/news/${prefix}-new`, statusCode: 301 });
    expect(await db.auditLog.findFirst({ where: { targetId: news.id, action: "CONTENT_UPDATED" }, orderBy: { createdAt: "desc" } })).toMatchObject({ metadata: expect.objectContaining({ slugChanged: true }) });
  });

  it("rejects stale edits, editors deleting permanently, and changes to trashed items", async () => {
    const service = await make("services", { slug: `${prefix}-stale`, title: `${prefix} Stale`, summary: "summary", coverMediaId: null, status: "DRAFT" });
    await expect(content.update("services", service.id, { slug: `${prefix}-stale`, title: "x", summary: "summary", coverMediaId: null, status: "DRAFT" }, actor, context, new Date(0).toISOString())).rejects.toMatchObject({ code: "CONFLICT" });
    const editor = await admin("EDITOR", "editor");
    await expect(content.transition("services", service.id, "delete", { id: editor.id, role: "EDITOR" }, context)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(content.transition("services", service.id, "delete", actor, context)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(content.transition("services", service.id, "restore", actor, context)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await content.transition("services", service.id, "trash", actor, context);
    await expect(content.transition("services", service.id, "trash", actor, context)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(content.transition("services", service.id, "publish", actor, context)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(content.update("services", service.id, { slug: `${prefix}-stale`, title: "x", summary: "summary", coverMediaId: null, status: "DRAFT" }, actor, context)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(content.transition("services", randomUUID(), "publish", actor, context)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("trashes, restores and permanently deletes every content type", async () => {
    const records = [
      ["banners", { title: `${prefix} Bin Banner`, description: "x", imageId: null, sortOrder: 1, status: "DRAFT" }],
      ["products", { slug: `${prefix}-bin-product`, name: `${prefix} Bin`, model: "B1", summary: "x", brandId, productTypeId: typeId, galleryMediaIds: [], status: "DRAFT" }],
      ["projects", { slug: `${prefix}-bin-project`, title: `${prefix} Bin`, projectType: "HVAC", area: "Bangkok", summary: "x", galleryMediaIds: [], serviceIds: [], status: "DRAFT" }],
      ["news", { slug: `${prefix}-bin-news`, title: `${prefix} Bin`, summary: "x", categoryId, coverMediaId: null, status: "PUBLISHED" }],
    ] as const;
    for (const [kind, input] of records) {
      const record = await make(kind, input);
      await content.transition(kind, record.id, "trash", actor, context);
      await content.transition(kind, record.id, "restore", actor, context);
      expect(await content.get(kind, record.id)).toMatchObject({ status: "DRAFT", deletedAt: null, publishedAt: null });
      await content.transition(kind, record.id, "trash", actor, context);
      await content.transition(kind, record.id, "delete", actor, context);
      expect(await content.get(kind, record.id, true)).toBeNull();
    }
  });

  it("lists with search, status filter and title sorting", async () => {
    await make("services", { slug: `${prefix}-alpha`, title: `${prefix} Alpha`, summary: "x", coverMediaId: null, status: "PUBLISHED" });
    await make("services", { slug: `${prefix}-beta`, title: `${prefix} Beta`, summary: "x", coverMediaId: null, status: "DRAFT" });
    const published = await content.list("services", { query: prefix, status: "PUBLISHED", sort: "title-asc" });
    expect(published.items.map(item => item.title)).toContain(`${prefix} Alpha`);
    expect(published.items.every(item => item.status === "PUBLISHED")).toBe(true);
    const descending = await content.list("services", { query: `${prefix} `, sort: "title-desc", pageSize: 100 });
    const titles = descending.items.map(item => item.title);
    expect(titles.indexOf(`${prefix} Beta`)).toBeLessThan(titles.indexOf(`${prefix} Alpha`));
    expect((await content.list("products", { query: `${prefix}-no-match`, sort: "updated-asc" })).total).toBe(0);
  });

  it("manages product types and news categories, and only lets a Super Admin delete them", async () => {
    const editor = await admin("EDITOR", "taxonomy-editor");
    for (const kind of ["product-types", "news-categories"] as const) {
      const item = await taxonomies.create(kind, { name: `${prefix} ${kind}`, slug: `${prefix}-${kind}-x`, sortOrder: 5, isActive: true }, actor, context);
      await taxonomies.update(kind, item.id, { name: `${prefix} ${kind} 2`, slug: `${prefix}-${kind}-x`, sortOrder: 6, isActive: true }, actor, context);
      expect((await taxonomies.list(kind)).find(row => row.id === item.id)).toMatchObject({ sortOrder: 6 });
      await taxonomies.remove(kind, item.id, actor, context);
      expect(() => taxonomies.transition(kind, item.id, "delete", { id: editor.id, role: "EDITOR" }, context)).toThrow("เฉพาะ Super Admin เท่านั้น");
      await taxonomies.transition(kind, item.id, "delete", actor, context);
    }
    await expect(taxonomies.remove("product-types", typeId, actor, context)).rejects.toMatchObject({ code: "IN_USE" });
    await expect(taxonomies.remove("news-categories", categoryId, actor, context)).rejects.toMatchObject({ code: "IN_USE" });
  });

  it("accepts only live sessions of active accounts and rotates tokens", async () => {
    const owner = await admin("SUPER_ADMIN", "session");
    const { token, session } = await createSession(owner.id, "PASSWORD_VERIFIED", { ipHash: "ip", userAgent: "vitest" });
    expect((await getSessionByToken(token))?.id).toBe(session.id);
    expect(session.twoFactorAt).toBeNull();
    expect(await getSessionByToken(undefined)).toBeNull();
    expect(await getSessionByToken("not-a-real-token")).toBeNull();

    const rotated = await rotateSession(session.id, "TWO_FACTOR_VERIFIED");
    expect(await getSessionByToken(token)).toBeNull();
    expect((await getSessionByToken(rotated))?.twoFactorAt).toBeInstanceOf(Date);

    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(Date.now() - 24 * 3_600_000) } });
    expect(await getSessionByToken(rotated)).toBeNull();
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    await db.admin.update({ where: { id: owner.id }, data: { isActive: false } });
    expect(await getSessionByToken(rotated)).toBeNull();
    await db.admin.update({ where: { id: owner.id }, data: { isActive: true } });
    await revokeUserSessions(owner.id);
    expect(await getSessionByToken(rotated)).toBeNull();
  });
});
