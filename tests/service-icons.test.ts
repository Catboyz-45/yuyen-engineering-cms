/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบไอคอนการ์ดบริการ ทั้งการเดาจากชื่อบริการและรายการที่ยอมให้บันทึก
 */
import { describe, expect, it } from "vitest";
import { resolveServiceIcon } from "@/lib/service-icons";
import { serviceSchema } from "@/server/cms/schemas";

describe("service card icons", () => {
  it("guesses a matching icon for each seeded service", () => {
    expect(resolveServiceIcon({ title: "ติดตั้งเครื่องปรับอากาศ", eyebrow: "INSTALLATION", slug: "installation" })).toBe("AIR_VENT");
    expect(resolveServiceIcon({ title: "ล้างและบำรุงรักษา", eyebrow: "MAINTENANCE", slug: "cleaning" })).toBe("DROPLETS");
    expect(resolveServiceIcon({ title: "ตรวจเช็กและซ่อมแซม", eyebrow: "REPAIR", slug: "repair" })).toBe("WRENCH");
    expect(resolveServiceIcon({ title: "งานระบบ M&E", eyebrow: "ENGINEERING", slug: "me-system" })).toBe("BUILDING");
  });

  it("prefers the icon an editor chose and ignores unknown stored values", () => {
    expect(resolveServiceIcon({ icon: "FAN", title: "ซ่อมแอร์" })).toBe("FAN");
    expect(resolveServiceIcon({ icon: "NOT_AN_ICON", title: "ซ่อมแอร์" })).toBe("WRENCH");
    expect(resolveServiceIcon({ title: "บริการอื่น ๆ" })).toBe("AIR_VENT");
  });

  it("only saves icons from the allowlist", () => {
    const base = { slug: "repair", title: "ซ่อม", summary: "ซ่อมแอร์" };
    expect(serviceSchema.parse({ ...base, icon: "WRENCH" }).icon).toBe("WRENCH");
    expect(serviceSchema.parse({ ...base, icon: null }).icon).toBeNull();
    expect(serviceSchema.parse(base).icon).toBeNull();
    expect(serviceSchema.safeParse({ ...base, icon: "<svg>" }).success).toBe(false);
  });
});
