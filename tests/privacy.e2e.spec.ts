/** ทดสอบหน้านโยบายและยืนยันว่า Google Maps ติดต่อภายนอกหลังผู้ใช้เลือกเท่านั้น */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const policies = [
  { path: "/privacy", title: "นโยบายความเป็นส่วนตัว" },
  { path: "/cookies", title: "นโยบายคุกกี้" },
  { path: "/terms", title: "เงื่อนไขการใช้เว็บไซต์" },
];

for (const width of [390, 1280]) {
  for (const policy of policies) {
    test(`${policy.path} อ่านและใช้คีย์บอร์ดได้ที่ความกว้าง ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(policy.path);
      await expect(page.getByRole("heading", { level: 1, name: policy.title, exact: true })).toBeVisible();
      await expect(page.locator(".legal-document")).toHaveCSS("padding-top", "48px");
      await expect(page.locator(".legal-section").first()).toHaveCSS("margin-top", "32px");
      const footer = page.getByRole("navigation", { name: "นโยบายและเงื่อนไข" });
      for (const link of policies) {
        await expect(footer.locator(`a[href="${link.path}"]`)).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      const firstSection = page.getByRole("navigation", { name: "สารบัญนโยบาย" }).getByRole("link").first();
      const anchor = await firstSection.getAttribute("href");
      await firstSection.focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => new URL(page.url()).hash).toBe(anchor);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(result.violations).toEqual([]);
    });
  }
}

test("ล็อกอินมีข้อความแจ้งข้อมูลและลิงก์นโยบาย ไม่บังคับยินยอมการตลาด", async ({ page }) => {
  await page.goto("/login");
  const notice = page.getByLabel("ข้อมูลส่วนบุคคลในการเข้าสู่ระบบ");
  await expect(notice).toBeVisible();
  for (const policy of policies) await expect(notice.locator(`a[href="${policy.path}"]`)).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("แผนที่รอการเลือก ปิดได้ และไม่จำความยินยอมข้ามการเปิดหน้า", async ({ page, context }) => {
  test.skip(!process.env.NEXT_PUBLIC_COMPANY_MAPS_EMBED_URL, "ใช้ฐานข้อมูลทดสอบว่างและกำหนด URL แผนที่ตามคู่มือ PRIVACY-OPERATIONS-TH.md");
  // ข้อมูลบริษัทใน CMS มีผลเหนือค่า environment จึงต้องใช้ฐานทดสอบที่ยังไม่มีข้อมูลบริษัทตามคู่มือ
  const database = new PrismaClient();
  const companyRows = await database.company.count().finally(() => database.$disconnect());
  expect(companyRows, "ต้องใช้ฐานข้อมูลทดสอบที่ยังไม่มีข้อมูลบริษัท (ไม่รัน seed) ตาม PRIVACY-OPERATIONS-TH.md").toBe(0);
  let googleRequests = 0;
  // ตอบด้วยหน้า HTML จำลองเพื่อไม่ส่งข้อมูลผู้ทดสอบไป Google จริง
  await context.route(/^https:\/\/(www|maps)\.google\.com\//, async (route) => {
    googleRequests += 1;
    await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="th"><title>แผนที่ทดสอบ</title><body>แผนที่จำลอง</body></html>' });
  });
  await page.goto("/contact");
  const consent = page.getByRole("region", { name: "แผนที่และความเป็นส่วนตัว" });
  const open = consent.getByRole("button", { name: "ยินยอมและโหลดแผนที่", exact: true });
  await expect(open).toBeVisible();
  await expect(consent.locator("iframe")).toHaveCount(0);
  expect(googleRequests).toBe(0);
  const cookiesBefore = await context.cookies();
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(consent.locator("iframe")).toHaveCount(1);
  await expect.poll(() => googleRequests).toBe(1);
  await expect(consent.getByRole("status")).toContainText("เปิดแผนที่แล้ว");
  await consent.getByRole("button", { name: "ปิดแผนที่และยกเลิกการโหลด" }).click();
  await expect(consent.locator("iframe")).toHaveCount(0);
  await expect(open).toBeFocused();
  expect(await context.cookies()).toEqual(cookiesBefore);
  await page.reload();
  await expect(open).toBeVisible();
  await expect(consent.locator("iframe")).toHaveCount(0);
  expect(googleRequests).toBe(1);
});
