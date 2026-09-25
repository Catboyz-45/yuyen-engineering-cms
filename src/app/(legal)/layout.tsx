/** หน้าที่ของไฟล์นี้: ทำให้นโยบายเปิดอ่านได้โดยไม่ต้องล็อกอินและไม่ต้องเชื่อมฐานข้อมูล */
import type { Metadata } from "next";
import { PublicShell } from "@/components/site-shell";
import { getLegalSettings } from "@/server/config/legal";

export const dynamic = "force-dynamic";

/** ฉบับร่างยังเข้าถึงผ่านลิงก์ได้ แต่ไม่ให้เครื่องมือค้นหานำไปแสดงเป็นนโยบายฉบับรับรอง */
export function generateMetadata(): Metadata {
  return { robots: { index: getLegalSettings().LEGAL_NOTICE_APPROVED === "true", follow: true } };
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
