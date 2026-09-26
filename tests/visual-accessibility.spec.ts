/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ visual-accessibility.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { addCmsSession, createCmsTestAdmin, deleteCmsTestAdmin } from "./support/cms-session";

const viewports = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-800", width: 800, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

const database = new PrismaClient();
const runId = randomUUID().slice(0, 8);
// ข้อมูลทดสอบชั่วคราว: สินค้าแบบร่างภายใต้ยี่ห้อ/ประเภทที่ปิดใช้งาน จึงไม่ปรากฏบนหน้า public และถูกลบใน afterAll
const fixture = { adminId: "", brandId: "", productTypeId: "", productId: "", productName: `สินค้าทดสอบ Playwright ${runId}` };

test.beforeAll(async () => {
  fixture.adminId = await createCmsTestAdmin(database, "visual", "ผู้ตรวจสอบ Visual Accessibility");
  const brand = await database.brand.create({ data: { slug: `playwright-brand-${runId}`, name: `ยี่ห้อทดสอบ Playwright ${runId}`, isActive: false }, select: { id: true } });
  fixture.brandId = brand.id;
  const productType = await database.productType.create({ data: { slug: `playwright-type-${runId}`, name: `ประเภททดสอบ Playwright ${runId}`, isActive: false }, select: { id: true } });
  fixture.productTypeId = productType.id;
  const product = await database.product.create({
    data: {
      slug: `playwright-product-${runId}`,
      name: fixture.productName,
      model: `PW-${runId}`,
      summary: "ข้อมูลทดสอบอัตโนมัติ ไม่ใช่สินค้าจริง",
      isSearchable: false,
      brandId: fixture.brandId,
      productTypeId: fixture.productTypeId,
    },
    select: { id: true },
  });
  fixture.productId = product.id;
});

test.afterAll(async () => {
  if (fixture.productId) await database.product.deleteMany({ where: { id: fixture.productId } });
  if (fixture.productTypeId) await database.productType.deleteMany({ where: { id: fixture.productTypeId } });
  if (fixture.brandId) await database.brand.deleteMany({ where: { id: fixture.brandId } });
  await deleteCmsTestAdmin(database, fixture.adminId);
  await database.$disconnect();
});

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ["/", "/products", "/admin", "/admin/products/daikin-smash-ii/edit"] as const) {
      test(`${route} ไม่มี horizontal overflow`, async ({ page }) => {
        if (route.startsWith("/admin")) await addCmsSession(page, database, fixture.adminId);
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(`${route}$`));
        await expect(page.locator(".skeleton")).toHaveCount(0);
        await expect(page.locator("body")).toBeVisible();
        const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect(overflows).toBe(false);
        await page.screenshot({ path: `test-results/${viewport.name}-${route.replaceAll("/", "-") || "home"}.png`, fullPage: true });
      });
    }
  });
}

test("หน้า public หลักผ่าน WCAG 2 A/AA อัตโนมัติ", async ({ page }) => {
  // รอให้หน้านิ่งก่อน: dev server บน WebKit เปลี่ยน URL ซ้ำหลังโหลด ทำให้ axe ที่เริ่มเร็วเกินไปหลุดกลางทาง
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".skeleton")).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("mobile drawer trap focus, ปิดด้วย Escape และคืน focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".skeleton")).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "เปิดเมนู" });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "เมนูหลักบนมือถือ" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("confirmation dialog trap focus, ปิดด้วย Escape และคืน focus", async ({ page }) => {
  await addCmsSession(page, database, fixture.adminId);
  await page.goto("/admin/products", { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: `ย้าย ${fixture.productName} ไปถังขยะ` });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole("button", { name: "ยกเลิก", exact: true });
  const confirm = dialog.getByRole("button", { name: "ย้ายไปถังขยะ", exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("dropdown ตัวกรองรองรับคีย์บอร์ดและส่งค่าที่เลือก", async ({ page }) => {
  await page.goto("/products");
  await expect(page.locator(".skeleton")).toHaveCount(0);
  const typeSelect = page.getByRole("combobox", { name: "กรองตามประเภท" });

  await typeSelect.focus();
  await page.keyboard.press("Enter");
  await expect(typeSelect).toHaveAttribute("aria-expanded", "true");
  await expect(typeSelect).toHaveAttribute("aria-activedescendant", /option-/);

  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(typeSelect).toBeFocused();
  await expect(typeSelect).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('input[name="type"]')).not.toHaveValue("");

  await page.keyboard.press("ArrowUp");
  await expect(typeSelect).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(typeSelect).toBeFocused();
  await expect(typeSelect).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("Home");
  await page.keyboard.press("Space");
  await expect(page.locator('input[name="type"]')).toHaveValue("");

  await page.keyboard.press("Enter");
  await typeSelect.press("Tab");
  await expect(typeSelect).toHaveAttribute("aria-expanded", "false");

  const brandSelect = page.getByRole("combobox", { name: "กรองตามยี่ห้อ" });
  await brandSelect.focus();
  await page.keyboard.type("D");
  await expect(brandSelect).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(brandSelect).toContainText("Daikin");
  await expect(page.locator('input[name="brand"]')).toHaveValue("daikin");
});

test("เลือกค่าใน dropdown แล้วย้ายไปช่องอื่นทันที โฟกัสไม่ถูกดึงกลับ", async ({ page }) => {
  // หน่วงเฟรมถัดไปให้ช้าเหมือนเครื่องที่กำลังทำงานหนัก: เดิม dropdown ดึงโฟกัสกลับมาที่ตัวเองหลังผู้ใช้กด Tab ไปแล้ว
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => original(time => window.setTimeout(() => callback(time), 150));
  });
  await page.goto("/products", { waitUntil: "networkidle" });
  const typeSelect = page.getByRole("combobox", { name: "กรองตามประเภท" });
  const brandSelect = page.getByRole("combobox", { name: "กรองตามยี่ห้อ" });
  await typeSelect.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await brandSelect.focus();
  await page.waitForTimeout(400);
  await expect(brandSelect).toBeFocused();
  await page.keyboard.type("D");
  await page.keyboard.press("Enter");
  await expect(brandSelect).toContainText("Daikin");
});
