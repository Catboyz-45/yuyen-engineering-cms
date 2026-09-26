/** หน้าที่ของไฟล์นี้: ตรวจว่าไม่ติดต่อแผนที่ก่อนยินยอม และไม่รับรองนโยบายที่ไม่มีช่องทางใช้สิทธิ์ */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsentMap } from "@/components/consent-map";
import { safeMapEmbedUrl } from "@/lib/map-embed";
import { getLegalSettings } from "@/server/config/legal";
import { isLegalNoticeApproved, legalRevision } from "@/lib/legal";

describe("map privacy", () => {
  it.each([
    "https://www.google.com/maps/embed?pb=example",
    "https://maps.google.com/maps/embed/v1/place?q=Bangkok",
  ])("accepts the allowed embed location: %s", value => {
    expect(safeMapEmbedUrl(value)).toBe(value);
  });
  it.each([
    "javascript:alert(1)", "http://www.google.com/maps/embed", "https://google.com.evil.test/maps/embed",
    "https://www.google.com/maps/embed-evil", "https://www.google.com/url?q=https://evil.test",
    "https://user:password@www.google.com/maps/embed", "https://www.google.com:8443/maps/embed",
    "https://example.com/maps/embed", "https://www.google.com/maps/embed/../../url", "", null,
  ])("rejects non-embed or unsafe destinations: %s", value => {
    expect(safeMapEmbedUrl(value)).toBeNull();
  });
  it("does not emit an iframe, preconnect, or external embed URL before interaction", () => {
    const url = "https://www.google.com/maps/embed?pb=example";
    const html = renderToStaticMarkup(createElement(ConsentMap, { embedUrl: url }));
    expect(html).toContain("ยินยอมและโหลดแผนที่");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("preconnect");
    expect(html).not.toContain(url);
  });
  it("fails closed for invalid stored URLs", () => {
    const html = renderToStaticMarkup(createElement(ConsentMap, { embedUrl: "https://evil.test/" }));
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<button");
  });
});

describe("policy publication", () => {
  const complete = { privacyEmail: "privacy@example.test", serviceProviders: "โฮสติ้งตัวอย่าง (ประเทศไทย)", retention: "ประวัติระบบ 1 ปี", approvedAt: new Date("2026-09-25T03:00:00Z"), approvedRevision: legalRevision };
  it("is a draft until a Super Admin approves the current text with every confirmed detail", () => {
    expect(isLegalNoticeApproved(null)).toBe(false);
    expect(isLegalNoticeApproved({ ...complete, approvedAt: null })).toBe(false);
    expect(isLegalNoticeApproved(complete)).toBe(true);
    for (const missing of ["privacyEmail", "serviceProviders", "retention"] as const) expect(isLegalNoticeApproved({ ...complete, [missing]: null })).toBe(false);
  });
  it("returns to draft when developers change the policy text after approval", () => {
    expect(isLegalNoticeApproved(complete, "ฉบับถัดไป")).toBe(false);
    expect(isLegalNoticeApproved({ ...complete, approvedRevision: "6 กันยายน 2569" })).toBe(false);
  });
  it("uses the same default lifetimes as authentication and rejects invalid configuration", () => {
    expect(getLegalSettings({})).toEqual({ SESSION_ABSOLUTE_HOURS: 12, SESSION_IDLE_MINUTES: 30, AUTH_SESSION_RETENTION_DAYS: 30, AUTH_THROTTLE_RETENTION_DAYS: 7 });
    expect(getLegalSettings({ SESSION_ABSOLUTE_HOURS: "8" }).SESSION_ABSOLUTE_HOURS).toBe(8);
    expect(() => getLegalSettings({ SESSION_ABSOLUTE_HOURS: "0" })).toThrow();
  });
});
