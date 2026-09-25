import { describe, expect, it, vi } from "vitest";
import { isHttpsUrl, isSafeHref } from "@/lib/links";
import { bannerSchema } from "@/server/cms/schemas";
import { companyInputSchema } from "@/server/services/company.service";

// The schema lives beside the service; the repository would open a database connection on import.
vi.mock("@/server/repositories/company.repository", () => ({ CompanyRepository: class {} }));

describe("link validation", () => {
  it.each(["https://line.me/R/ti/p/@yuyen", "/products", "/services/cleaning?utm=1#top"])("accepts %s", value => expect(isSafeHref(value)).toBe(true));
  it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<script>", "http://example.com", "//evil.example", "/\\evil.example", "/ path", "mailto:a@b.c", "not a url"])("rejects %s", value => expect(isSafeHref(value)).toBe(false));
  it("requires HTTPS for absolute URLs", () => {
    expect(isHttpsUrl("https://www.facebook.com/page")).toBe(true);
    expect(isHttpsUrl("http://www.facebook.com/page")).toBe(false);
    expect(isHttpsUrl("/relative")).toBe(false);
  });
  it("validates banner button links", () => {
    expect(bannerSchema.parse({ title: "Banner", buttonUrl: "/contact" }).buttonUrl).toBe("/contact");
    expect(bannerSchema.parse({ title: "Banner", buttonUrl: "" }).buttonUrl).toBeNull();
    expect(bannerSchema.safeParse({ title: "Banner", buttonUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("validates company links and map embeds", () => {
    const base = { legalName: "บริษัท ทดสอบ จำกัด", displayName: "ทดสอบ" };
    expect(companyInputSchema.parse({ ...base, facebookUrl: "https://www.facebook.com/page", mapsEmbedUrl: "https://www.google.com/maps/embed?pb=1" })).toMatchObject({ facebookUrl: "https://www.facebook.com/page" });
    expect(companyInputSchema.parse({ ...base, lineUrl: "" }).lineUrl).toBeNull();
    expect(companyInputSchema.safeParse({ ...base, lineUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(companyInputSchema.safeParse({ ...base, facebookUrl: "http://www.facebook.com/page" }).success).toBe(false);
    expect(companyInputSchema.safeParse({ ...base, mapsEmbedUrl: "https://evil.example/maps/embed" }).success).toBe(false);
  });
});
