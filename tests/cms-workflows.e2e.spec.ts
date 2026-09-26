import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

// Runs against a database where the bootstrap command created E2E_ADMIN_USERNAME with a temporary
// password and nobody has signed in yet (CI does this in the e2e job). The tests share that account
// and build on each other, so they run in order.
const ownerUsername = process.env.E2E_ADMIN_USERNAME;
const ownerTemporaryPassword = process.env.E2E_ADMIN_PASSWORD;
const ownerPassword = "E2e-Owner-Password-1!";
const runId = Date.now().toString(36);
let ownerSecret = "";

// A retry would replay the one-time first sign-in, so failures must be investigated rather than retried.
test.describe.configure({ mode: "serial", retries: 0, timeout: 120_000 });
// ต้องมีบัญชี Super Admin ที่ CI สร้างด้วย auth:bootstrap; เครื่องที่ไม่ได้ตั้งค่าจะข้ามชุดนี้
test.skip(!ownerUsername || !ownerTemporaryPassword, "E2E bootstrap credentials are not configured");

const code = (secret: string) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
// ระบบปฏิเสธรหัสของช่วง 30 วินาทีที่บัญชีเพิ่งใช้ไป (กันนำรหัสกลับมาใช้ซ้ำ) จึงรอช่วงถัดไปเมื่อจำเป็น
const usedSteps = new Map<string, number>();
async function freshCode(secret: string) {
  let step = Math.floor(Date.now() / 30_000);
  if (usedSteps.get(secret) === step) { await new Promise(resolve => setTimeout(resolve, (step + 1) * 30_000 - Date.now() + 250)); step += 1; }
  usedSteps.set(secret, step);
  return code(secret);
}

async function enterOtp(page: Page, secret: string) {
  const value = await freshCode(secret);
  for (let index = 0; index < 6; index += 1) await page.getByLabel(`หลักที่ ${index + 1}`).fill(value[index]);
  await page.locator("form button.btn-dark").click();
}

async function submitLogin(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("form button.btn-dark").click();
}

/** Temporary password → new password → authenticator enrollment → recovery codes → dashboard. */
async function completeFirstSignIn(page: Page, username: string, temporaryPassword: string, newPassword: string) {
  await submitLogin(page, username, temporaryPassword);
  await expect(page).toHaveURL(/\/change-password$/);
  await page.locator("#new-password").fill(newPassword);
  await page.locator("#confirm-password").fill(newPassword);
  await page.getByRole("button", { name: /บันทึกและดำเนินการต่อ/ }).click();
  await expect(page).toHaveURL(/\/setup-2fa$/);
  const secret = (await page.locator(".secret-key span").textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  await page.getByRole("link", { name: /สแกนแล้ว ดำเนินการต่อ/ }).click();
  await expect(page).toHaveURL(/\/setup-2fa\/verify$/);
  await enterOtp(page, secret);
  // รหัสกู้คืนแสดงในหน้าเดิมทันทีหลังยืนยัน (ไม่ส่งผ่าน URL เพื่อไม่ให้ค้างในประวัติเบราว์เซอร์)
  await expect(page.locator(".recovery-code")).toHaveCount(10);
  await page.getByLabel("ฉันบันทึกรหัสเหล่านี้ไว้ในที่ปลอดภัยแล้ว").check();
  await page.getByRole("button", { name: /เสร็จสิ้นและเข้าสู่ระบบ/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  return secret;
}

async function signIn(page: Page, username: string, password: string, secret: string) {
  await submitLogin(page, username, password);
  await expect(page).toHaveURL(/\/verify-2fa$/);
  await enterOtp(page, secret);
  await expect(page).toHaveURL(/\/admin$/);
}

async function ownerPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, ownerUsername!, ownerPassword, ownerSecret);
  return page;
}

/**
 * Public pages stream behind loading.tsx, so a missing record cannot change the already-sent 200 status;
 * Next.js renders the not-found page and injects a noindex robots tag instead.
 */
async function expectHiddenFromPublic(request: APIRequestContext, path: string, text: string) {
  const body = await (await request.get(path)).text();
  expect(body).toContain('<meta name="robots" content="noindex"/>');
  expect(body).toContain("ไม่พบหน้าที่ต้องการ");
  expect(body).not.toContain(text);
}

async function cmsJson<T>(request: APIRequestContext, method: "GET" | "POST" | "PATCH", url: string, data?: unknown): Promise<T> {
  const response = await request.fetch(url, { method, data, headers: { Origin: new URL(url, test.info().project.use.baseURL).origin } });
  expect(response.ok(), `${method} ${url} → ${response.status()} ${await response.text()}`).toBe(true);
  return response.json() as Promise<T>;
}

test("first sign-in forces a password change and 2FA enrollment", async ({ page }) => {
  ownerSecret = await completeFirstSignIn(page, ownerUsername!, ownerTemporaryPassword!, ownerPassword);
  await expect(page.locator(".sidebar-user")).toContainText("Super Admin");
  await expect(page.locator(".sidebar").getByRole("link", { name: "ผู้ดูแลระบบ" })).toBeVisible();
});

test("sign-in requires the second factor before the CMS opens", async ({ page }) => {
  await submitLogin(page, ownerUsername!, ownerPassword);
  await expect(page).toHaveURL(/\/verify-2fa$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/verify-2fa$/);
  for (let index = 0; index < 6; index += 1) await page.getByLabel(`หลักที่ ${index + 1}`).fill("0");
  await page.locator("form button.btn-dark").click();
  await expect(page.locator(".auth-alert.error")).toContainText("รหัสไม่ถูกต้อง");
  await enterOtp(page, ownerSecret);
  await expect(page).toHaveURL(/\/admin$/);
});

test("a service is created, published, trashed and restored", async ({ browser }) => {
  const page = await ownerPage(browser);
  const slug = `e2e-service-${runId}`; const title = `บริการทดสอบ ${runId}`;
  await page.goto("/admin/services/new");
  await page.locator('[name="title"]').fill(title);
  await page.locator('[name="slug"]').fill(slug);
  await page.locator('[name="summary"]').fill("บริการสำหรับทดสอบอัตโนมัติ");
  await page.getByRole("button", { name: /บันทึกและเผยแพร่/ }).click();
  await expect(page).toHaveURL(/\/admin\/services$/);

  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto(`/services/${slug}`);
  await expect(publicPage.getByRole("heading", { level: 1 })).toContainText(title);

  const { items } = await cmsJson<{ items: Array<{ id: string; slug: string }> }>(page.request, "GET", `/api/admin/content/services?query=${encodeURIComponent(title)}`);
  const id = items.find(item => item.slug === slug)!.id;
  await cmsJson(page.request, "POST", `/api/admin/content/services/${id}/transition`, { action: "trash" });
  await expectHiddenFromPublic(visitor.request, `/services/${slug}`, title);

  await page.goto("/admin/trash");
  await page.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: /กู้คืน/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "กู้คืน" }).click();
  await expect(page.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);
  // Restored content returns as a draft and stays hidden until it is published again.
  await expectHiddenFromPublic(visitor.request, `/services/${slug}`, title);
  await cmsJson(page.request, "POST", `/api/admin/content/services/${id}/transition`, { action: "publish" });
  await publicPage.goto(`/services/${slug}`);
  await expect(publicPage.getByRole("heading", { level: 1 })).toContainText(title);
  await visitor.close();
});

test("a new administrator must change the temporary password, and a reset forces it again", async ({ browser }) => {
  const owner = await ownerPage(browser);
  const username = `e2e-editor-${runId}`; const displayName = `ผู้แก้ไข ${runId}`;
  await owner.goto("/admin/admins");
  await owner.getByRole("button", { name: /เพิ่มผู้ดูแล/ }).click();
  await owner.locator("#admin-name").fill(displayName);
  await owner.locator("#admin-username").fill(username);
  // บทบาทเริ่มต้นของบัญชีใหม่คือ Editor อยู่แล้ว
  await expect(owner.locator("#admin-role")).toContainText("Editor");
  await owner.getByRole("dialog").getByRole("button", { name: "บันทึก" }).click();
  const temporaryPassword = await owner.locator("#temporary-password").inputValue();
  expect(temporaryPassword.length).toBeGreaterThan(12);
  await owner.getByRole("button", { name: "รับทราบและปิด" }).click();

  const editor = await (await browser.newContext()).newPage();
  const editorSecret = await completeFirstSignIn(editor, username, temporaryPassword, "E2e-Editor-Password-1!");
  await expect(editor.locator(".sidebar-user")).toContainText(displayName);
  await expect(editor.locator(".sidebar").getByRole("link", { name: "ผู้ดูแลระบบ" })).toHaveCount(0);
  expect((await editor.request.get("/api/admin/users")).status()).toBe(403);
  await editor.goto("/admin/admins");
  await expect(editor).not.toHaveURL(/\/admin\/admins$/);

  await owner.getByRole("button", { name: `รีเซ็ตรหัสผ่าน ${displayName}` }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "ยืนยัน" }).click();
  const resetPassword = await owner.locator("#temporary-password").inputValue();
  expect(resetPassword).not.toBe(temporaryPassword);

  await editor.goto("/admin");
  await expect(editor).toHaveURL(/\/login$/);
  await submitLogin(editor, username, resetPassword);
  await expect(editor).toHaveURL(/\/change-password$/);
  await editor.locator("#new-password").fill("E2e-Editor-Password-2!");
  await editor.locator("#confirm-password").fill("E2e-Editor-Password-2!");
  await editor.getByRole("button", { name: /บันทึกและดำเนินการต่อ/ }).click();
  await expect(editor).toHaveURL(/\/verify-2fa$/);
  await enterOtp(editor, editorSecret);
  await expect(editor).toHaveURL(/\/admin$/);
});

test("visitors find published products by name, brand and BTU", async ({ browser }) => {
  const owner = await ownerPage(browser);
  const brand = await cmsJson<{ item: { id: string } }>(owner.request, "POST", "/api/admin/taxonomies/brands", { name: `E2E Brand ${runId}`, slug: `e2e-brand-${runId}` });
  const type = await cmsJson<{ item: { id: string } }>(owner.request, "POST", "/api/admin/taxonomies/product-types", { name: `E2E Type ${runId}`, slug: `e2e-type-${runId}` });
  const model = `E2E-${runId.toUpperCase()}`;
  await cmsJson(owner.request, "POST", "/api/admin/content/products", { slug: `e2e-product-${runId}`, name: `แอร์ทดสอบ ${runId}`, model, summary: "สินค้าสำหรับทดสอบการค้นหา", btuMin: 9000, btuMax: 12000, brandId: brand.item.id, productTypeId: type.item.id, status: "PUBLISHED" });
  await cmsJson(owner.request, "POST", "/api/admin/content/products", { slug: `e2e-draft-${runId}`, name: `แอร์ฉบับร่าง ${runId}`, model: `${model}-DRAFT`, summary: "ต้องไม่แสดงบนเว็บไซต์", brandId: brand.item.id, productTypeId: type.item.id, status: "DRAFT" });

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/products");
  await visitor.getByPlaceholder("ค้นหาชื่อหรือรุ่น").fill(model);
  await visitor.getByRole("combobox", { name: "กรองตามยี่ห้อ" }).click();
  await visitor.getByRole("option", { name: `E2E Brand ${runId}` }).click();
  await visitor.getByLabel("กรองตาม BTU").fill("10000");
  await visitor.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(visitor).toHaveURL(new RegExp(`q=${model}`));
  await expect(visitor.getByText("พบสินค้า 1 รายการ")).toBeVisible();
  await expect(visitor.getByText(`แอร์ทดสอบ ${runId}`)).toBeVisible();
  await expect(visitor.getByText(`แอร์ฉบับร่าง ${runId}`)).toHaveCount(0);

  await visitor.getByLabel("กรองตาม BTU").fill("24000");
  await visitor.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(visitor.getByText("พบสินค้า 0 รายการ")).toBeVisible();
  await expectHiddenFromPublic(visitor.request, `/products/e2e-draft-${runId}`, `แอร์ฉบับร่าง ${runId}`);
});
