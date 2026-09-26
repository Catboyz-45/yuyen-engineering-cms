/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ section-nav.test ยืนยันว่าเมนู "ในหน้านี้" ไฮไลต์หัวข้อที่เลื่อนถึงถูกต้อง
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { activeSectionId } from "@/components/admin/section-nav";

describe("section navigation highlight", () => {
  const sections = (tops: number[]) => tops.map((top, index) => ({ id: `s${index + 1}`, top }));

  it("highlights the first section before anything has scrolled past the reference line", () => {
    expect(activeSectionId(sections([200, 900, 1600]), false)).toBe("s1");
  });

  it("highlights the last section whose top has passed the reference line", () => {
    expect(activeSectionId(sections([-800, 120, 700]), false)).toBe("s2");
    expect(activeSectionId(sections([-1600, -700, 90]), false)).toBe("s3");
  });

  it("highlights the last section at the bottom of the page even if it is short", () => {
    expect(activeSectionId(sections([-1600, -700, 400]), true)).toBe("s3");
    expect(activeSectionId([], false)).toBeNull();
  });
});
