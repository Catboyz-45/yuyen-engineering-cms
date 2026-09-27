/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบการเลือกรูปแบบป้ายเล็กเหนือหัวข้อตามภาษา
 */
import { describe, expect, it } from "vitest";
import { eyebrowClass } from "@/lib/eyebrow";

describe("eyebrow style", () => {
  it("keeps wide letter spacing for English labels only", () => {
    expect(eyebrowClass("OUR SERVICES")).toBe("eyebrow");
    expect(eyebrowClass("โทรศัพท์")).toBe("eyebrow eyebrow-th");
    expect(eyebrowClass("M&E งานระบบ")).toBe("eyebrow eyebrow-th");
    expect(eyebrowClass(null)).toBe("eyebrow");
  });
});
