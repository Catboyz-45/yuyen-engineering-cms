/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ company-display.test ยืนยันว่าหน้าเว็บไม่ย้อนไปแสดงค่าตัวอย่างเมื่อบริษัทบันทึกข้อมูลใน CMS แล้ว
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { resolvePublicCompany } from "@/lib/company-display";
import { companyPublicConfig } from "@/lib/public-config";

describe("public company display", () => {
  it("uses labelled sample values only before the company is saved in the CMS", () => {
    const company = resolvePublicCompany(null);
    expect(company.isPlaceholder).toBe(true);
    expect(company.phoneDisplay).toBe(companyPublicConfig.phoneDisplay);
    expect(company.logo).toBeNull();
  });

  it("hides fields the company left empty instead of falling back to sample values", () => {
    const company = resolvePublicCompany({ displayName: "บริษัทจริง", phoneDisplay: null, phoneHref: "", email: "  ", lineLabel: null, businessHours: null, address: "123 ถนนจริง" });
    expect(company).toMatchObject({ name: "บริษัทจริง", phoneDisplay: null, phoneHref: null, email: null, lineLabel: null, businessHours: null, address: "123 ถนนจริง", isPlaceholder: false });
  });

  it("exposes only the logo id and alt text", () => {
    expect(resolvePublicCompany({ displayName: "บริษัทจริง", logoMedia: { id: "logo-1", altText: null } }).logo).toEqual({ id: "logo-1", altText: "" });
  });
});
