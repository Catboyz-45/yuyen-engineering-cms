/**
 * หน้าที่ของไฟล์นี้: ไฟล์ตั้งค่า playwright.config.ts อธิบายให้เครื่องมือ build, test หรือ lint ทำงานสอดคล้องกัน
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// เลือกเบราว์เซอร์ด้วย PLAYWRIGHT_BROWSERS=chromium,webkit (webkit คือเอนจินเดียวกับ Safari) ค่าเริ่มต้นคือ chromium
// รันทีละเบราว์เซอร์ต่อฐานข้อมูลทดสอบหนึ่งชุด เพราะบางเทสต์ใช้ข้อมูลครั้งเดียว เช่นรหัสผ่านชั่วคราวและการตั้ง 2FA ครั้งแรก
const browsers = (process.env.PLAYWRIGHT_BROWSERS ?? "chromium").split(",").map(name => name.trim()).filter(Boolean);
const supportedBrowsers = ["chromium", "webkit"] as const;
for (const name of browsers) {
  if (!supportedBrowsers.includes(name as (typeof supportedBrowsers)[number])) throw new Error(`PLAYWRIGHT_BROWSERS: unsupported browser "${name}"`);
}
const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const serverURL = `http://localhost:${port}`;
// E2E_HTTPS_PORT: ทดสอบผ่าน HTTPS ชั่วคราว (scripts/https-test-proxy.ts) เพราะ WebKit ไม่รับ cookie แบบ Secure บน http://localhost
const httpsPort = process.env.E2E_HTTPS_PORT;
const baseURL = httpsPort ? `https://localhost:${httpsPort}` : serverURL;

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    ignoreHTTPSErrors: Boolean(httpsPort),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: browsers.map(name => ({
    name,
    use: {
      browserName: name as (typeof supportedBrowsers)[number],
      launchOptions: name === "chromium" && existsSync(macChrome) ? { executablePath: macChrome } : undefined,
    },
  })),
  webServer: [
    {
      command: process.env.CI ? `npm run build && npm run start -- -p ${port}` : `npm run dev -- -p ${port}`,
      url: serverURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    ...(httpsPort ? [{ command: "npx tsx scripts/https-test-proxy.ts", url: baseURL, ignoreHTTPSErrors: true, reuseExistingServer: true, timeout: 30_000 }] : []),
  ],
});
