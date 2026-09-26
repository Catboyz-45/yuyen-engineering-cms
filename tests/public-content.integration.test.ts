/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบข้อมูลหน้าเว็บสาธารณะกับฐานข้อมูลทดสอบจริง
 * ยืนยันว่าหน้าเว็บเห็นเฉพาะรายการที่เผยแพร่แล้ว ไม่เห็นฉบับร่าง รายการเก็บถาวร รายการในถังขยะ หรือข่าวที่ตั้งเวลาไว้
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ทดสอบกฎการคัดข้อมูล ไม่ใช่แคชของ Next.js จึงให้ unstable_cache เรียกฟังก์ชันตรง ๆ
vi.mock("next/cache", () => ({ unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));

import { db } from "@/server/db";
import { PublicContentService } from "@/server/services/public-content.service";

const suite = describe.runIf(process.env.RUN_INTEGRATION === "1");
const prefix = `public-${randomUUID().slice(0, 8)}`;
const now = Date.now();
const yesterday = new Date(now - 86_400_000);
const tomorrow = new Date(now + 86_400_000);

suite("public content visibility", () => {
  const service = new PublicContentService();
  const ids = { services: [] as string[], products: [] as string[], projects: [] as string[], news: [] as string[], banners: [] as string[] };
  let brandId = "";
  let typeId = "";
  let categoryId = "";

  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL ?? "").pathname;
    if (!/(test|e2e|sandbox)/i.test(database)) throw new Error("Refusing to run against a non-test database");
    brandId = (await db.brand.create({ data: { name: `${prefix} Brand`, slug: `${prefix}-brand` } })).id;
    typeId = (await db.productType.create({ data: { name: `${prefix} Type`, slug: `${prefix}-type` } })).id;
    categoryId = (await db.newsCategory.create({ data: { name: `${prefix} Category`, slug: `${prefix}-category` } })).id;
    const states = [
      ["live", { status: "PUBLISHED", publishedAt: yesterday }],
      ["draft", { status: "DRAFT", publishedAt: null }],
      ["archived", { status: "ARCHIVED", publishedAt: yesterday }],
      ["trashed", { status: "PUBLISHED", publishedAt: yesterday, deletedAt: new Date(), purgeAt: tomorrow }],
    ] as const;
    for (const [state, data] of states) {
      ids.services.push((await db.service.create({ data: { slug: `${prefix}-service-${state}`, title: `${prefix} Service ${state}`, summary: "x", ...data } })).id);
      ids.products.push((await db.product.create({ data: { slug: `${prefix}-product-${state}`, name: `${prefix} Product ${state}`, model: `${prefix}-${state}`, summary: "x", brandId, productTypeId: typeId, btuMin: 9000, btuMax: 12000, ...data } })).id);
      ids.projects.push((await db.project.create({ data: { slug: `${prefix}-project-${state}`, title: `${prefix} Project ${state}`, projectType: `${prefix} Type`, area: "Bangkok", summary: "x", ...data } })).id);
      ids.news.push((await db.news.create({ data: { slug: `${prefix}-news-${state}`, title: `${prefix} News ${state}`, summary: "x", categoryId, ...data } })).id);
    }
    ids.news.push((await db.news.create({ data: { slug: `${prefix}-news-scheduled`, title: `${prefix} News scheduled`, summary: "x", categoryId, status: "PUBLISHED", publishedAt: tomorrow } })).id);
    // ผลงานที่เผยแพร่ผูกกับบริการทุกสถานะ: live, draft, archived, trashed
    await db.projectService.createMany({ data: ids.services.map(serviceId => ({ projectId: ids.projects[0], serviceId })) });
    ids.banners.push((await db.banner.create({ data: { title: `${prefix} Banner`, status: "PUBLISHED", publishedAt: yesterday, sortOrder: 0 } })).id);
    ids.banners.push((await db.banner.create({ data: { title: `${prefix} Draft banner`, status: "DRAFT", sortOrder: 0 } })).id);
  });

  afterAll(async () => {
    await db.banner.deleteMany({ where: { id: { in: ids.banners } } });
    await db.news.deleteMany({ where: { id: { in: ids.news } } });
    await db.project.deleteMany({ where: { id: { in: ids.projects } } });
    await db.product.deleteMany({ where: { id: { in: ids.products } } });
    await db.service.deleteMany({ where: { id: { in: ids.services } } });
    await db.brand.deleteMany({ where: { id: brandId } });
    await db.productType.deleteMany({ where: { id: typeId } });
    await db.newsCategory.deleteMany({ where: { id: categoryId } });
    await db.$disconnect();
  });

  const visibleSlugs = (items: Array<{ slug: string }>) => items.map(item => item.slug).filter(slug => slug.startsWith(prefix));

  it("lists only live services, products, projects and news", async () => {
    expect(visibleSlugs(await service.listServices())).toEqual([`${prefix}-service-live`]);
    expect(visibleSlugs((await service.listProducts({ query: prefix, pageSize: 50 })).items)).toEqual([`${prefix}-product-live`]);
    expect(visibleSlugs((await service.listProjects({ query: prefix, pageSize: 50 })).items)).toEqual([`${prefix}-project-live`]);
    expect(visibleSlugs((await service.listNews({ query: prefix, pageSize: 50 })).items)).toEqual([`${prefix}-news-live`]);
  });

  it("filters products and news by taxonomy and ignores malformed filter values", async () => {
    expect(visibleSlugs((await service.listProducts({ brandSlug: `${prefix}-brand`, typeSlug: `${prefix}-type`, btu: 10000 })).items)).toEqual([`${prefix}-product-live`]);
    expect(visibleSlugs((await service.listProducts({ brandSlug: "Not A Slug!", query: prefix })).items)).toEqual([`${prefix}-product-live`]);
    expect(visibleSlugs((await service.listNews({ categorySlug: `${prefix}-category` })).items)).toEqual([`${prefix}-news-live`]);
    expect(visibleSlugs((await service.listProjects({ projectType: `${prefix} Type` })).items)).toEqual([`${prefix}-project-live`]);
    expect((await service.getProjectTypes()).map(row => row.projectType)).toContain(`${prefix} Type`);
  });

  it("opens detail pages only for live items and valid slugs", async () => {
    expect(await service.getService(`${prefix}-service-live`)).toMatchObject({ title: `${prefix} Service live` });
    expect(await service.getProduct(`${prefix}-product-live`)).toMatchObject({ name: `${prefix} Product live` });
    expect(await service.getProject(`${prefix}-project-live`)).toMatchObject({ title: `${prefix} Project live` });
    expect(await service.getNews(`${prefix}-news-live`)).toMatchObject({ title: `${prefix} News live` });
    for (const state of ["draft", "archived", "trashed"]) {
      expect(await service.getService(`${prefix}-service-${state}`)).toBeNull();
      expect(await service.getProduct(`${prefix}-product-${state}`)).toBeNull();
      expect(await service.getProject(`${prefix}-project-${state}`)).toBeNull();
      expect(await service.getNews(`${prefix}-news-${state}`)).toBeNull();
    }
    expect(await service.getNews(`${prefix}-news-scheduled`)).toBeNull();
    for (const invalid of ["", "UPPER", "../etc/passwd"]) {
      expect(await service.getService(invalid)).toBeNull();
      expect(await service.getProduct(invalid)).toBeNull();
      expect(await service.getProject(invalid)).toBeNull();
      expect(await service.getNews(invalid)).toBeNull();
    }
  });

  it("links a project only to services that are live", async () => {
    const project = await service.getProject(`${prefix}-project-live`);
    expect(project?.services).toEqual([{ service: { slug: `${prefix}-service-live`, title: `${prefix} Service live` } }]);
  });

  it("returns the first live banner, active filters and company data", async () => {
    const banner = await service.getHomeBanner();
    expect(banner).toMatchObject({ status: "PUBLISHED", deletedAt: null });
    expect(banner?.publishedAt?.getTime()).toBeLessThanOrEqual(Date.now());
    const [brands, types] = await service.getProductFilters();
    expect(brands.map(brand => brand.slug)).toContain(`${prefix}-brand`);
    expect(types.map(type => type.slug)).toContain(`${prefix}-type`);
    expect((await service.getNewsCategories()).map(category => category.slug)).toContain(`${prefix}-category`);
    await expect(service.getCompany()).resolves.toBeDefined();
  });
});
