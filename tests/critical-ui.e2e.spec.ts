/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ critical-ui.e2e.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const runAdmin = process.env.RUN_CRITICAL_UI_E2E === "1";
const baseURL = process.env.TEST_BASE_URL ?? process.env.APP_URL ?? "http://127.0.0.1:3000";

async function authenticateTemporaryAdmin(page: Page) {
  const database = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const username = `critical-ui-${suffix}`;
  const admin = await database.admin.create({
    data: {
      username,
      usernameNormalized: username,
      displayName: "Critical UI Test",
      role: "SUPER_ADMIN",
      passwordHash: await argon2.hash(`Critical-UI-${suffix}!Aa1`, { type: argon2.argon2id }),
      mustChangePassword: false,
      twoFactorEnabled: true,
    },
  });
  const token = randomBytes(32).toString("base64url");
  await database.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      adminId: admin.id,
      twoFactorAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });
  await page.context().addCookies([{ name: "yuyen_session", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
  return async () => {
    await database.auditLog.deleteMany({ where: { actorId: admin.id } });
    await database.admin.delete({ where: { id: admin.id } }).catch(() => undefined);
    await database.$disconnect();
  };
}

test("ผู้ใช้ทั่วไปค้นหาและกรองสินค้า พร้อมใช้ dropdown ด้วยคีย์บอร์ดโดยหน้าไม่เลื่อน", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByText(/พบสินค้า \d+ รายการ/)).toBeVisible();
  const firstProduct = page.locator(".grid-4 .card h3").first();
  const productName = (await firstProduct.textContent())?.trim();
  expect(productName).toBeTruthy();
  await page.getByRole("textbox", { name: "ค้นหาสินค้า" }).fill(productName!);
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("heading", { name: productName! })).toBeVisible();

  const typeSelect = page.getByRole("combobox", { name: "กรองตามประเภท" });
  await typeSelect.focus();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  await expect(typeSelect).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expect(page.locator('input[name="type"]')).toHaveValue("");
  await page.keyboard.press("Enter");
  await expect(page.locator('input[name="type"]')).not.toHaveValue("");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page).toHaveURL(/type=/);
  await expect(page.getByText(/จากเงื่อนไขที่เลือก/)).toBeVisible();
});

test("mobile drawer trap focus ปิดด้วย Escape และคืน focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "เปิดเมนู" });
  await trigger.focus();
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "เมนูหลักบนมือถือ" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test.describe("authenticated CMS interaction", () => {
  test.skip(!runAdmin, "Set RUN_CRITICAL_UI_E2E=1 and use an isolated test database");
  test("ป้องกันข้อมูลฟอร์มหาย ใช้ confirmation dialog และ logout ได้จริง", async ({ page }) => {
    const cleanup = await authenticateTemporaryAdmin(page);
    try {
      await page.goto("/admin/company");
      const legalName = page.getByLabel("ชื่อบริษัทตามกฎหมาย");
      await expect(legalName).toBeVisible();
      const original = await legalName.inputValue();
      await legalName.fill(`${original} ทดสอบยังไม่บันทึก`);
      await page.getByRole("link", { name: "ภาพรวม" }).click();
      const leaveDialog = page.getByRole("alertdialog");
      await expect(leaveDialog).toBeVisible();
      await expect(page.getByRole("button", { name: "ยกเลิก" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(leaveDialog).toBeHidden();
      await expect(legalName).toHaveValue(`${original} ทดสอบยังไม่บันทึก`);
      await page.getByRole("button", { name: "ออกจากระบบ" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await cleanup();
    }
  });

  test("แก้ข้อมูลบริษัท โลโก้ และรูปบริษัทจากหลังบ้าน แล้วหน้าเว็บแสดงตามจริง", async ({ page }) => {
    test.skip(!process.env.S3_ENDPOINT, "ต้องมี object storage และ ClamAV สำหรับอัปโหลดรูป");
    const database = new PrismaClient();
    const original = await database.company.findUnique({ where: { singletonKey: "PRIMARY" }, include: { gallery: true } });
    const cleanup = await authenticateTemporaryAdmin(page);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAJ0lEQVQ4jWNQKHChKWIYtaBgNIhcRlORwmhGcxktKhRGS9MC2lY4ALoY3RAnTlWmAAAAAElFTkSuQmCC", "base64");
    const values = `คุณค่าทดสอบ ${randomUUID().slice(0, 8)}`;
    try {
      await page.goto("/admin/company");
      await expect(page.getByLabel("ชื่อบริษัทตามกฎหมาย")).toBeVisible();
      await page.getByLabel("คุณค่าของเรา").fill(values);
      await page.getByLabel("SEO title").fill(`SEO ${values}`);
      await page.getByLabel("หัวข้อหน้าเกี่ยวกับเรา").fill(`หัวข้อ ${values}`);
      await page.getByLabel("จุดเด่นที่ 1 — หัวข้อ").fill(`จุดเด่น ${values}`);
      await page.getByLabel("ป้ายเล็กบนภาพหน้าแรก").fill("");
      await page.getByLabel("เบอร์โทรที่แสดง").fill("");
      await page.getByLabel("เบอร์โทรสำหรับลิงก์").fill("");
      await page.getByLabel("โลโก้บริษัท", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
      await page.getByLabel(/รูปบริษัทสำหรับหน้าเกี่ยวกับเรา/).setInputFiles({ name: "office.png", mimeType: "image/png", buffer: png });
      await expect(page.locator('input[type="hidden"][name="logoMediaId"]')).toHaveCount(1, { timeout: 30_000 });
      await expect(page.locator('input[type="hidden"][name="galleryMediaIds"]')).toHaveCount(1, { timeout: 30_000 });
      await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
      await expect(page.getByText("บันทึกข้อมูลบริษัทเรียบร้อยแล้ว")).toBeVisible();

      await page.goto("/");
      await expect(page).toHaveTitle(`SEO ${values}`);
      await expect(page.getByText(`จุดเด่น ${values}`)).toBeVisible();
      await expect(page.locator(".hero-badge")).toHaveCount(0);

      await page.goto("/about");
      await expect(page.getByText(values, { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(`หัวข้อ ${values}`);
      const photo = page.locator("main picture img").first();
      await expect(photo).toBeVisible();
      // โหลดผ่าน /api/media -> signed URL ของ storage จริง จึงยืนยัน CSP img-src และ redirect ไปพร้อมกัน
      await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect.poll(() => page.locator("header .brand-logo").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

      await page.goto("/contact");
      await expect(page.getByRole("link", { name: "โทรหาเรา" })).toHaveCount(0);
      await expect(page.getByText("ข้อมูลตัวอย่างสำหรับการพัฒนาระบบ")).toHaveCount(0);
    } finally {
      if (original) {
        const { id, createdAt: _createdAt, updatedAt: _updatedAt, gallery, siteCopy, ...data } = original;
        await database.companyMedia.deleteMany({ where: { companyId: id } });
        await database.company.update({ where: { id }, data: { ...data, siteCopy: siteCopy ?? Prisma.DbNull, gallery: { create: gallery.map(({ mediaId, sortOrder }) => ({ mediaId, sortOrder })) } } });
      }
      await database.$disconnect();
      await cleanup();
    }
  });

  test("Super Admin ยืนยันข้อมูลนโยบายและรับรองจากหลังบ้าน แล้วหน้านโยบายเลิกเป็นฉบับร่าง", async ({ page }) => {
    const database = new PrismaClient();
    const original = await database.legalNotice.findUnique({ where: { singletonKey: "PRIMARY" } });
    const cleanup = await authenticateTemporaryAdmin(page);
    const email = `privacy-${randomUUID().slice(0, 8)}@example.test`;
    try {
      await database.legalNotice.deleteMany({ where: { singletonKey: "PRIMARY" } });
      await page.goto("/admin/legal");
      await expect(page.getByText(/^ฉบับร่าง/)).toBeVisible();
      await page.getByLabel("อีเมลรับคำร้องเรื่องข้อมูลส่วนบุคคล").fill(email);
      await page.getByLabel(/รับรองและประกาศใช้นโยบาย/).check();
      await page.getByRole("button", { name: "บันทึก", exact: true }).click();
      // รับรองไม่ได้จนกว่าจะกรอกข้อมูลที่บริษัทต้องยืนยันครบ
      await expect(page.getByText("ต้องระบุผู้ให้บริการก่อนรับรอง")).toBeVisible();
      await page.getByLabel("ผู้ให้บริการและพื้นที่จัดเก็บข้อมูล").fill("โฮสติ้งทดสอบ (ประเทศไทย)\nที่เก็บไฟล์ทดสอบ (สิงคโปร์)");
      await page.getByLabel("ระยะเวลาเก็บข้อมูลที่บริษัทกำหนด").fill("ประวัติระบบเก็บ 1 ปี แล้วลบ");
      await page.getByRole("button", { name: "บันทึก", exact: true }).click();
      await expect(page.getByText("บันทึกและประกาศใช้นโยบายเรียบร้อยแล้ว")).toBeVisible();
      await expect(page.getByText(/^ประกาศใช้แล้ว/)).toBeVisible();

      await page.goto("/privacy");
      await expect(page.getByLabel("สถานะเอกสาร")).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/);
      await expect(page.getByRole("link", { name: email })).toHaveAttribute("href", `mailto:${email}`);
      await expect(page.getByText("ที่เก็บไฟล์ทดสอบ (สิงคโปร์)")).toBeVisible();
      await expect(page.getByText("ประวัติระบบเก็บ 1 ปี แล้วลบ")).toBeVisible();
      await expect(page.getByText(/Vercel|Neon/)).toHaveCount(0);
      expect(await (await page.request.get("/sitemap.xml")).text()).toContain("/privacy</loc>");

      await page.goto("/admin/legal");
      await page.getByLabel(/รับรองและประกาศใช้นโยบาย/).uncheck();
      await page.getByRole("button", { name: "บันทึก", exact: true }).click();
      await expect(page.getByText("บันทึกข้อมูลนโยบายเรียบร้อยแล้ว (ฉบับร่าง)")).toBeVisible();
      await page.goto("/terms");
      await expect(page.getByLabel("สถานะเอกสาร")).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    } finally {
      await database.legalNotice.deleteMany({ where: { singletonKey: "PRIMARY" } });
      if (original) await database.legalNotice.create({ data: original });
      await database.$disconnect();
      await cleanup();
    }
  });

  test("เพิ่ม เผยแพร่ ย้ายลงถังขยะ และกู้คืนเนื้อหา", async ({ page }) => {
    const cleanup = await authenticateTemporaryAdmin(page);
    const headers = { Origin: process.env.APP_URL ?? baseURL };
    let id: string | undefined;
    try {
      const created = await page.request.post("/api/admin/content/banners", {
        headers,
        data: { title: `Critical content ${randomUUID()}`, status: "DRAFT" },
      });
      expect(created.status()).toBe(201);
      id = ((await created.json()) as { record: { id: string } }).record.id;
      for (const action of ["publish", "trash", "restore"] as const) {
        const response = await page.request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action } });
        expect(response.status()).toBe(200);
      }
    } finally {
      if (id) {
        await page.request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "trash" } }).catch(() => undefined);
        await page.request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "delete" } }).catch(() => undefined);
      }
      await cleanup();
    }
  });
});
