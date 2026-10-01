/**
 * หน้าที่ของไฟล์นี้: สร้างภาพตัวอย่างเมื่อแชร์เว็บไซต์ไปยังโซเชียลมีเดีย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// ภาพนี้สร้างครั้งเดียวตอน build จึงอ่านไฟล์โลโก้จากโปรเจกต์ได้โดยตรง
const logoSrc = `data:image/png;base64,${await readFile(join(process.cwd(), "src/assets/yuyen-logo.png"), "base64")}`;

export const alt = "อยู่เย็นเป็นสุข วิศวกรรม — ระบบปรับอากาศและงาน M&E";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** สร้างส่วนหน้าจอ OpenGraphImage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: 80, color: "white", background: "#072d1e", fontFamily: "sans-serif", position: "relative" }}>
      <div style={{ position: "absolute", right: -120, top: -100, width: 560, height: 560, borderRadius: 999, border: "100px solid rgba(134,214,62,.12)" }} />
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 850 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 26, color: "#bde990" }}>
          <div style={{ display: "flex", width: 76, height: 76, padding: 6, borderRadius: 18, background: "white" }}>
            <img src={logoSrc} width={64} height={64} alt="" />
          </div>
          อยู่เย็นเป็นสุข วิศวกรรม จำกัด
        </div>
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 800, lineHeight: 1.08 }}><span>เย็นสบาย มั่นใจได้</span><span>ในทุกพื้นที่ของคุณ</span></div>
        <div style={{ marginTop: 28, fontSize: 28, color: "rgba(255,255,255,.72)" }}>ระบบปรับอากาศ · งาน M&E · บริการดูแลครบวงจร</div>
      </div>
    </div>,
    size,
  );
}
