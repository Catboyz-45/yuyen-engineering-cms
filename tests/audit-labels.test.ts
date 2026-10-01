/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ audit-labels.test ยืนยันว่ากิจกรรมในหน้าภาพรวมแสดงเป็นภาษาไทยและไม่ทำให้รายการหาย
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { auditLabel } from "@/lib/audit-labels";

describe("dashboard activity labels", () => {
  it("describes content changes with the Thai name of the content type", () => {
    expect(auditLabel("CONTENT_PUBLISHED", "Product")).toBe("เผยแพร่สินค้า");
    expect(auditLabel("CONTENT_TRASHED", "News")).toBe("ย้ายข่าวสารลงถังขยะ");
    expect(auditLabel("TAXONOMY_CREATED", "Brand")).toBe("สร้างยี่ห้อ");
    expect(auditLabel("COMPANY_UPDATED", "Company")).toBe("แก้ไขข้อมูลบริษัท");
  });

  it("marks failures and falls back to the raw code for unknown actions", () => {
    expect(auditLabel("CONTENT_PUBLISHED_FAILED", "Service", "FAILURE")).toBe("เผยแพร่บริการ (ไม่สำเร็จ)");
    expect(auditLabel("AUTH_LOGIN", "Admin", "FAILURE")).toBe("เข้าสู่ระบบ (ไม่สำเร็จ)");
    expect(auditLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
