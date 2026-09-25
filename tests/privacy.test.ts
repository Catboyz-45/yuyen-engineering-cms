/** หน้าที่ของไฟล์นี้: ตรวจว่าไม่ติดต่อแผนที่ก่อนยินยอม และไม่รับรองนโยบายที่ไม่มีช่องทางใช้สิทธิ์ */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsentMap } from "@/components/consent-map";
import { safeMapEmbedUrl } from "@/lib/map-embed";
import { getLegalSettings } from "@/server/config/legal";

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
  it("defaults to a draft with the same default retention as authentication", () => {
    expect(getLegalSettings({})).toMatchObject({ LEGAL_NOTICE_APPROVED: "false", SESSION_ABSOLUTE_HOURS: 12, SESSION_IDLE_MINUTES: 30, AUTH_SESSION_RETENTION_DAYS: 30, AUTH_THROTTLE_RETENTION_DAYS: 7 });
  });
  it("requires a valid contact before publication", () => {
    expect(() => getLegalSettings({ LEGAL_NOTICE_APPROVED: "true" })).toThrow();
    expect(() => getLegalSettings({ PRIVACY_CONTACT_EMAIL: "not-an-email" })).toThrow();
    expect(getLegalSettings({ LEGAL_NOTICE_APPROVED: "true", PRIVACY_CONTACT_EMAIL: "privacy@example.test" }).LEGAL_NOTICE_APPROVED).toBe("true");
  });
  it("uses configured lifetimes and rejects invalid configuration", () => {
    expect(getLegalSettings({ SESSION_ABSOLUTE_HOURS: "8" }).SESSION_ABSOLUTE_HOURS).toBe(8);
    expect(() => getLegalSettings({ SESSION_ABSOLUTE_HOURS: "0" })).toThrow();
    expect(() => getLegalSettings({ LEGAL_NOTICE_APPROVED: "yes" })).toThrow();
  });
});
