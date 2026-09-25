/** หน้าที่ของไฟล์นี้: รอผู้ใช้เลือกก่อนติดต่อ Google Maps และยกเลิกการโหลดได้จากหน้าเดิม */
"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { safeMapEmbedUrl } from "@/lib/map-embed";

/** ความยินยอมอยู่ในหน่วยความจำของหน้าเท่านั้น ไม่มีคุกกี้ ตัวติดตาม หรือประวัติผู้ใช้เพิ่ม */
export function ConsentMap({ embedUrl }: { embedUrl: string }) {
  const url = safeMapEmbedUrl(embedUrl);
  const [allowedUrl, setAllowedUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const loadButton = useRef<HTMLButtonElement>(null);
  const shown = url !== null && allowedUrl === url;

  // คงโฟกัสไว้ที่ปุ่มเปิดหลังปิด iframe เพื่อให้ใช้งานต่อด้วยคีย์บอร์ดได้
  function closeMap() {
    setAllowedUrl(null);
    setLoaded(false);
    requestAnimationFrame(() => loadButton.current?.focus());
  }

  if (!url) return <p className="card-body">แผนที่ยังไม่พร้อมใช้งาน กรุณาใช้ช่องทางติดต่อบริษัทที่แสดงในหน้านี้</p>;

  return (
    <section className="consent-map" aria-label="แผนที่และความเป็นส่วนตัว">
      <div className="card-body stack">
        <h2 className="subheading">แผนที่ Google Maps</h2>
        <p>เมื่อเลือกโหลดแผนที่ Google จะได้รับข้อมูลการเชื่อมต่อ เช่น IP และข้อมูลเบราว์เซอร์ และอาจใช้คุกกี้ตามการตั้งค่าของคุณ คุณอ่านข้อมูลติดต่อได้โดยไม่ต้องเปิดแผนที่</p>
        <p><Link href="/cookies#optional">อ่านเรื่องแผนที่และคุกกี้</Link></p>
        {shown ? (
          <button className="btn btn-outline" type="button" onClick={closeMap}>ปิดแผนที่และยกเลิกการโหลด</button>
        ) : (
          <button ref={loadButton} className="btn btn-primary" type="button" onClick={() => { setLoaded(false); setAllowedUrl(url); }}>ยินยอมและโหลดแผนที่</button>
        )}
        <p className="muted" role="status">{shown ? (loaded ? "เปิดแผนที่แล้ว หากแผนที่ไม่แสดง กรุณาลองใหม่หรือใช้ช่องทางติดต่ออื่น" : "กำลังโหลดแผนที่ หากโหลดไม่สำเร็จ คุณปิดแผนที่หรือใช้ช่องทางติดต่ออื่นได้") : "แผนที่ยังไม่เชื่อมต่อกับ Google"}</p>
      </div>
      {/* ไม่สร้าง iframe แม้แต่แบบซ่อนไว้จนกว่าจะได้รับการเลือกจากผู้ใช้ */}
      {shown && <iframe key={url} className="map-frame" src={url} title="แผนที่บริษัท อยู่เย็นเป็นสุข วิศวกรรม" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} allowFullScreen />}
    </section>
  );
}
