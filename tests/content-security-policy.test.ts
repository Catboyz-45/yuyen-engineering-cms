/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ content-security-policy.test ยืนยันว่า CSP อนุญาต storage ที่ signed URL ใช้จริงและไม่เปิดกว้างเกินจำเป็น
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/content-security-policy";
import { storageBrowserOrigins } from "@/server/storage/browser-origin";

function directive(policy: string, name: string) {
  return policy.split("; ").find((entry) => entry.startsWith(`${name} `));
}

describe("storage browser origins", () => {
  it("uses the endpoint origin for path-style storage", () => {
    expect(storageBrowserOrigins({ S3_ENDPOINT: "http://127.0.0.1:9000/", S3_BUCKET: "media", S3_FORCE_PATH_STYLE: "true" })).toEqual(["http://127.0.0.1:9000"]);
  });

  it("prefers the public endpoint over the internal one", () => {
    expect(storageBrowserOrigins({ S3_ENDPOINT: "http://minio:9000", S3_PUBLIC_ENDPOINT: "http://localhost:9000", S3_BUCKET: "media", S3_FORCE_PATH_STYLE: "true" })).toEqual(["http://localhost:9000"]);
  });

  it("includes the virtual-hosted bucket origin when path style is off", () => {
    expect(storageBrowserOrigins({ S3_ENDPOINT: "https://account.r2.cloudflarestorage.com", S3_BUCKET: "yuyen-media" })).toEqual(["https://account.r2.cloudflarestorage.com", "https://yuyen-media.account.r2.cloudflarestorage.com"]);
  });

  it("derives AWS regional origins when no endpoint is set", () => {
    expect(storageBrowserOrigins({ S3_BUCKET: "yuyen-media", S3_REGION: "ap-southeast-1" })).toEqual(["https://yuyen-media.s3.ap-southeast-1.amazonaws.com", "https://s3.ap-southeast-1.amazonaws.com"]);
  });

  it("returns nothing for missing or malformed configuration", () => {
    expect(storageBrowserOrigins({})).toEqual([]);
    expect(storageBrowserOrigins({ S3_ENDPOINT: "not a url" })).toEqual([]);
    expect(storageBrowserOrigins({ S3_BUCKET: "media", S3_REGION: "auto" })).toEqual([]);
    expect(storageBrowserOrigins({ S3_BUCKET: "bad; script-src *", S3_REGION: "ap-southeast-1" })).toEqual([]);
    expect(storageBrowserOrigins({ S3_ENDPOINT: "https://storage.example.co.th", S3_BUCKET: "bad; script-src *" })).toEqual(["https://storage.example.co.th"]);
  });
});

describe("content security policy", () => {
  it("allows storage origins for images and uploads only", () => {
    const policy = buildContentSecurityPolicy({ nodeEnv: "production", storageOrigins: ["https://storage.example.co.th"] });
    expect(directive(policy, "img-src")).toBe("img-src 'self' data: blob: https://storage.example.co.th");
    expect(directive(policy, "connect-src")).toBe("connect-src 'self' https://storage.example.co.th");
    expect(directive(policy, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy.endsWith("upgrade-insecure-requests")).toBe(true);
  });

  it("only relaxes eval and HTTPS upgrades outside production", () => {
    const development = buildContentSecurityPolicy({ nodeEnv: "development", storageOrigins: [] });
    expect(directive(development, "script-src")).toContain("'unsafe-eval'");
    expect(directive(development, "img-src")).toBe("img-src 'self' data: blob:");
    expect(development).not.toContain("upgrade-insecure-requests");
  });
});
