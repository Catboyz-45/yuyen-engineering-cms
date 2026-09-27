/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบการแสดงช่วง BTU ของสินค้าให้เหมือนกันทุกหน้า
 */
import { describe, expect, it } from "vitest";
import { formatBtuRange } from "@/lib/btu";

describe("BTU range", () => {
  it("groups thousands and handles partial or missing values", () => {
    expect(formatBtuRange(9000, 25000)).toBe("9,000–25,000 BTU");
    expect(formatBtuRange(12000, 12000)).toBe("12,000 BTU");
    expect(formatBtuRange(9000, null)).toBe("9,000 BTU");
    expect(formatBtuRange(null, 18000)).toBe("18,000 BTU");
    expect(formatBtuRange(null, null)).toBe("สอบถามขนาด");
  });
});
