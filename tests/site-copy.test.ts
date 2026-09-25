/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ site-copy.test ยืนยันกฎข้อความบนหน้าเว็บที่แก้จากหลังบ้าน
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_COPY } from "@/lib/site-copy";
import { resolveSiteCopy, siteCopySchema } from "@/server/services/site-copy";
import { readSiteCopy } from "@/components/admin/site-copy-fields";

describe("editable site copy", () => {
  it("uses the default copy until the company saves its own", () => {
    expect(resolveSiteCopy(null)).toEqual(DEFAULT_SITE_COPY);
    expect(resolveSiteCopy([])).toEqual(DEFAULT_SITE_COPY);
  });

  it("uses saved copy, keeping cleared optional text empty so the page hides it", () => {
    const copy = resolveSiteCopy({ ...DEFAULT_SITE_COPY, heroBadge: "", ctaTitle: "คุยกับเรา", highlights: [{ title: "รับประกันงาน", text: "" }], processSteps: [] });
    expect(copy).toMatchObject({ heroBadge: "", ctaTitle: "คุยกับเรา", highlights: [{ title: "รับประกันงาน", text: "" }], processSteps: [] });
  });

  it("falls back per field when stored copy is invalid or from an older version", () => {
    const copy = resolveSiteCopy({ heroTitle: "", ctaTitle: 42, footerTagline: "คำโปรยใหม่" });
    expect(copy.heroTitle).toBe(DEFAULT_SITE_COPY.heroTitle);
    expect(copy.ctaTitle).toBe(DEFAULT_SITE_COPY.ctaTitle);
    expect(copy.footerTagline).toBe("คำโปรยใหม่");
    expect(copy.processSteps).toEqual(DEFAULT_SITE_COPY.processSteps);
  });

  it("rejects missing headings, unknown keys, oversized text and too many items on save", () => {
    expect(siteCopySchema.safeParse(DEFAULT_SITE_COPY).success).toBe(true);
    expect(siteCopySchema.safeParse({ ...DEFAULT_SITE_COPY, servicesHeading: " " }).success).toBe(false);
    expect(siteCopySchema.safeParse({ ...DEFAULT_SITE_COPY, script: "<script>" }).success).toBe(false);
    expect(siteCopySchema.safeParse({ ...DEFAULT_SITE_COPY, heroText: "ก".repeat(301) }).success).toBe(false);
    expect(siteCopySchema.safeParse({ ...DEFAULT_SITE_COPY, highlights: Array.from({ length: 4 }, () => ({ title: "x", text: "" })) }).success).toBe(false);
  });

  it("reads the admin form, dropping empty rows and flagging text without a title", () => {
    const form = new FormData();
    form.set("copy.heroTitle", "  หัวข้อใหม่  ");
    form.set("copy.highlights.0.title", "มาตรฐาน");
    form.set("copy.highlights.0.text", "ใส่ใจ");
    form.set("copy.processSteps.2.title", "ส่งมอบ");
    const read = readSiteCopy(form);
    expect("copy" in read && read.copy).toMatchObject({ heroTitle: "หัวข้อใหม่", heroBadge: "", highlights: [{ title: "มาตรฐาน", text: "ใส่ใจ" }], processSteps: [{ title: "ส่งมอบ", text: "" }] });
    form.set("copy.highlights.1.text", "มีแต่คำอธิบาย");
    expect(readSiteCopy(form)).toEqual({ error: "จุดเด่นที่ 2 ต้องมีหัวข้อ" });
  });
});
