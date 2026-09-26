/**
 * หน้าที่ของไฟล์นี้: ลิงก์ของหน้าเว็บสาธารณะที่แสดงสถานะกำลังเปิดหน้าใหม่ระหว่างการนำทางฝั่งเบราว์เซอร์
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: หน้าสาธารณะไม่มี loading.tsx เพื่อให้ HTML ครั้งแรกมีเนื้อหาครบแม้ปิด JavaScript
 * สถานะกำลังโหลดตอนคลิกลิงก์จึงมาจากแถบความคืบหน้าด้านบนของไฟล์นี้แทนโครงร่าง (skeleton)
 */
"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";

/** แสดงแถบความคืบหน้าและทำเครื่องหมาย aria-busy ที่เนื้อหาหลักขณะลิงก์ที่ครอบอยู่กำลังนำทาง */
function NavigationPendingIndicator() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    const main = document.getElementById("main-content");
    main?.setAttribute("aria-busy", "true");
    return () => main?.removeAttribute("aria-busy");
  }, [pending]);
  // portal ไปที่ body เพื่อไม่ให้ transform ของการ์ดทำให้ position: fixed ผิดตำแหน่ง
  if (!pending) return null;
  return createPortal(<div className="route-progress" role="status" aria-live="polite"><span className="sr-only">กำลังเปิดหน้า กรุณารอสักครู่</span></div>, document.body);
}

/** สร้างลิงก์ next/link ที่มีตัวบอกสถานะกำลังโหลด; ใช้แทน Link ในหน้าสาธารณะ */
export function PublicLink({ children, ...props }: React.ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<NavigationPendingIndicator /></Link>;
}
