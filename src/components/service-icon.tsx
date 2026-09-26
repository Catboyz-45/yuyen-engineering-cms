/**
 * หน้าที่ของไฟล์นี้: วาดไอคอนเส้นของบริการตามชื่อใน src/lib/service-icons.ts ใช้ได้ทั้งหน้าเว็บและหน้าแก้ไข
 */
import { AirVent, Building2, ClipboardCheck, Droplets, Fan, HardHat, Snowflake, Thermometer, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { ServiceIconKey } from "@/lib/service-icons";

const icons: Record<ServiceIconKey, LucideIcon> = {
  AIR_VENT: AirVent,
  SNOWFLAKE: Snowflake,
  DROPLETS: Droplets,
  WRENCH: Wrench,
  CLIPBOARD_CHECK: ClipboardCheck,
  BUILDING: Building2,
  ZAP: Zap,
  FAN: Fan,
  THERMOMETER: Thermometer,
  HARD_HAT: HardHat,
};

/** ไอคอนตกแต่ง ซ่อนจากโปรแกรมอ่านหน้าจอ เพราะชื่อบริการบอกความหมายอยู่แล้ว */
export function ServiceIcon({ name, size = 32 }: Readonly<{ name: ServiceIconKey; size?: number }>) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
