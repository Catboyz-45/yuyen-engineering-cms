/**
 * หน้าที่ของไฟล์นี้: แถบโลโก้แบรนด์เลื่อนวน ดัดแปลงแนวคิดจาก Logo Loop ของ React Bits
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: รายชื่อแบรนด์มาจากเมนูยี่ห้อสินค้าในหลังบ้าน แบรนด์ที่ยังไม่มีโลโก้แสดงเป็นชื่อแทน
 * แถบเลื่อนเองนานเกิน 5 วินาที จึงมีปุ่มหยุด (WCAG 2.2.2) และหยุดเมื่อเอาเมาส์ชี้
 * โปรแกรมอ่านหน้าจออ่านรายชื่อแบรนด์ครั้งเดียว ส่วนที่เลื่อนเป็นภาพซ้ำจึงซ่อนไว้
 */
"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

type Brand = { id: string; name: string; logoMedia: { id: string } | null };

// ให้แต่ละรอบยาวกว่าความกว้างจอ แบรนด์น้อยจึงวนซ้ำในรอบเดียวกันจนครบจำนวนนี้
const MIN_ITEMS_PER_LOOP = 8;

function BrandMark({ brand }: Readonly<{ brand: Brand }>) {
  if (!brand.logoMedia) return <span className="brand-wordmark">{brand.name}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- /api/media already serves resized WebP; the Next image optimizer is not used
  return <img src={`/api/media/${brand.logoMedia.id}?format=webp&width=320`} alt="" loading="lazy" height={40} />;
}

export function BrandStrip({ heading, brands }: Readonly<{ heading: string; brands: Brand[] }>) {
  const [paused, setPaused] = useState(false);
  if (!brands.length) return null;
  const loop = Array.from({ length: Math.ceil(MIN_ITEMS_PER_LOOP / brands.length) }, () => brands).flat();
  return (
    <div className="brand-strip">
      {heading && <h2 className="brand-strip-heading">{heading}</h2>}
      <ul className="sr-only">{brands.map(brand => <li key={brand.id}>{brand.name}</li>)}</ul>
      <div className="logo-loop" data-paused={paused || undefined} aria-hidden="true" style={{ "--loop-duration": `${loop.length * 3.5}s` } as React.CSSProperties}>
        <div className="logo-loop-track">
          {[0, 1].map(copy => (
            <ul className="logo-loop-list" key={copy}>
              {loop.map((brand, index) => <li key={`${brand.id}-${index}`} className={index >= brands.length ? "logo-loop-repeat" : undefined}><BrandMark brand={brand} /></li>)}
            </ul>
          ))}
        </div>
      </div>
      <button type="button" className="loop-toggle" aria-pressed={paused} aria-label="หยุดแถบแบรนด์ที่เลื่อนอยู่" title={paused ? "เล่นแถบแบรนด์ต่อ" : "หยุดแถบแบรนด์"} onClick={() => setPaused(value => !value)}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
      </button>
    </div>
  );
}
