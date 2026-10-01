/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ public-rendering.spec ยืนยันว่า HTML ครั้งแรกของหน้าสาธารณะมีเนื้อหาครบแม้ปิด JavaScript
 * และการนำทางฝั่งเบราว์เซอร์ยังแสดงสถานะกำลังโหลด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { expect, test, type Page } from "@playwright/test";

const publicRoutes = ["/", "/about", "/services", "/products", "/projects", "/news", "/contact"] as const;
const detailCollections = ["/services", "/products", "/projects", "/news"] as const;

/** หน่วงคำขอ RSC ของการนำทางฝั่งเบราว์เซอร์ เพื่อให้เห็นสถานะกำลังโหลดได้แน่นอน */
async function delayClientNavigation(page: Page, milliseconds = 1_500) {
  await page.route("**/*", async (route) => {
    if (route.request().headers()["rsc"] === "1") await new Promise((resolve) => setTimeout(resolve, milliseconds));
    await route.continue();
  });
}

// เบราว์เซอร์มาจาก project ใน playwright.config.ts (PLAYWRIGHT_BROWSERS) จึงรันทั้ง Chromium และ WebKit ได้โดยไม่ต้องวนเอง
test("หน้าสาธารณะแสดงเนื้อหาครบเมื่อปิด JavaScript", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const routes: string[] = [...publicRoutes];
  for (const collection of detailCollections) {
    const html = await (await request.get(collection)).text();
    const detail = html.match(new RegExp(`href="(${collection}/[^"/?#]+)"`))?.[1];
    if (detail) routes.push(detail);
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator("main h1"), route).toBeVisible();
      // เนื้อหาที่ stream หลัง Suspense fallback จะอยู่ใน <div hidden id="S:n"> จนกว่าสคริปต์จะสลับตำแหน่ง
      await expect(page.locator('div[hidden][id^="S:"]'), route).toHaveCount(0);
      await expect(page.locator(".skeleton"), route).toHaveCount(0);
      // metadata จาก generateMetadata ต้องอยู่ใน <head> ของ HTML ครั้งแรก ไม่ใช่ stream ตามมาภายหลัง
      await expect(page.locator('head link[rel="canonical"]'), route).toHaveCount(1);
      await expect(page.locator('head meta[name="description"]'), route).toHaveCount(1);
    }
  } finally {
    await context.close();
  }
});

test("slug ที่ไม่มีอยู่ตอบ HTTP 404 จริง ไม่ใช่ 200 แบบ stream", async ({ request }) => {
  for (const collection of detailCollections) {
    const response = await request.get(`${collection}/not-a-real-slug-404`);
    expect(response.status(), collection).toBe(404);
  }
});

test("การนำทางด้วยลิงก์แสดงแถบกำลังโหลดและ aria-busy จนหน้าใหม่พร้อม", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // ตั้งการหน่วงก่อนเปิดหน้า: production build prefetch หน้าปลายทางตั้งแต่โหลดเสร็จ ถ้าหน่วงทีหลัง หน้าใหม่จะมาเร็วจนจับสถานะกำลังโหลดไม่ทัน
  await delayClientNavigation(page);
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
  await page.locator(".nav-links").getByRole("link", { name: "สินค้า" }).click();
  await expect(page.locator(".route-progress")).toBeVisible();
  await expect(page.locator("#main-content")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("heading", { level: 1, name: "สินค้าเครื่องปรับอากาศ" })).toBeVisible();
  await expect(page.locator(".route-progress")).toHaveCount(0);
  await expect(page.locator("#main-content")).not.toHaveAttribute("aria-busy", "true");
});

test("เมนูมือถือเปิดค้างพร้อมแถบกำลังโหลดจนเปลี่ยนหน้าเสร็จ", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // ตั้งการหน่วงก่อนเปิดหน้า: production build prefetch หน้าปลายทางตั้งแต่โหลดเสร็จ ถ้าหน่วงทีหลัง หน้าใหม่จะมาเร็วจนจับสถานะกำลังโหลดไม่ทัน
  await delayClientNavigation(page);
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
  await page.getByRole("button", { name: "เปิดเมนู" }).click();
  const drawer = page.getByRole("dialog", { name: "เมนูหลักบนมือถือ" });
  await drawer.getByRole("link", { name: "ข่าวสาร" }).click();
  await expect(page.locator(".route-progress")).toBeVisible();
  await expect(drawer).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "ข่าวสารและบทความ" })).toBeVisible();
  await expect(drawer).toBeHidden();
  await expect(page.locator(".route-progress")).toHaveCount(0);
});
