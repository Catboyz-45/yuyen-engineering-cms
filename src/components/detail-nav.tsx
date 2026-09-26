/**
 * หน้าที่ของไฟล์นี้: ส่วนบนสุดของหน้ารายละเอียด ปุ่มย้อนกลับอยู่มุมซ้ายบน แล้วตามด้วยเส้นทางของหน้านี้ในบรรทัดถัดไป
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** rootLabel คือชื่อหน้ารวม เช่น "สินค้า" ใช้ทั้งในปุ่ม "กลับไปหน้าสินค้า" และลำดับแรกของเส้นทาง */
export function DetailNav({ href, rootLabel, trail }: Readonly<{ href: string; rootLabel: string; trail: string[] }>) {
  return (
    <div className="detail-nav">
      <Link className="back-link" href={href}><ArrowLeft size={16} aria-hidden="true" /> กลับไปหน้า{rootLabel}</Link>
      <nav className="breadcrumbs" aria-label="เส้นทางหน้า">
        <Link href={href}>{rootLabel}</Link>
        {trail.map((item, position) => (
          <span key={item} className="cluster">
            <span aria-hidden="true">/</span>
            <span aria-current={position === trail.length - 1 ? "page" : undefined}>{item}</span>
          </span>
        ))}
      </nav>
    </div>
  );
}
