/**
 * หน้าที่ของไฟล์นี้: แถบบนสุดของหน้ารายละเอียด ปุ่มย้อนกลับไปหน้ารวมอยู่มุมซ้าย ตามด้วยเส้นทางของหน้านี้
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** ปุ่มย้อนกลับทำหน้าที่เป็นลำดับแรกของเส้นทาง (breadcrumb) จึงไม่ต้องมีลิงก์หน้ารวมซ้ำ */
export function DetailNav({ backHref, backLabel, trail }: Readonly<{ backHref: string; backLabel: string; trail: string[] }>) {
  return (
    <nav className="breadcrumbs detail-nav" aria-label="เส้นทางหน้า">
      <Link className="back-link" href={backHref}><ArrowLeft size={16} aria-hidden="true" /> {backLabel}</Link>
      {trail.map((item, position) => (
        <span key={item} className="cluster">
          <span aria-hidden="true">/</span>
          <span aria-current={position === trail.length - 1 ? "page" : undefined}>{item}</span>
        </span>
      ))}
    </nav>
  );
}
