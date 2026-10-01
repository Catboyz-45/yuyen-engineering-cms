/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบการตรวจเลขทะเบียนนิติบุคคล 13 หลักและเลขตรวจสอบหลักสุดท้าย
 */
import { describe, expect, it } from "vitest";
import { isValidRegistrationNumber } from "@/lib/registration-number";
import { companyInputSchema } from "@/server/services/company.service";

describe("juristic person registration number", () => {
  it("accepts the company's registered number", () => {
    expect(isValidRegistrationNumber("0105569026761")).toBe(true);
  });

  it("rejects a mistyped check digit, wrong length or non-digits", () => {
    expect(isValidRegistrationNumber("0105569026762")).toBe(false);
    expect(isValidRegistrationNumber("010556902676")).toBe(false);
    expect(isValidRegistrationNumber("01055690267610")).toBe(false);
    expect(isValidRegistrationNumber("0105-69026761")).toBe(false);
  });

  it("is optional in company input but must be valid when given", () => {
    const base = { legalName: "บริษัท ทดสอบ จำกัด", displayName: "ทดสอบ" };
    expect(companyInputSchema.safeParse({ ...base, registrationNumber: null }).success).toBe(true);
    expect(companyInputSchema.safeParse({ ...base, registrationNumber: " 0105569026761 " }).data?.registrationNumber).toBe("0105569026761");
    expect(companyInputSchema.safeParse({ ...base, registrationNumber: "0105569026762" }).success).toBe(false);
  });
});
