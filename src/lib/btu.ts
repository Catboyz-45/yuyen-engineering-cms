/**
 * หน้าที่ของไฟล์นี้: แสดงช่วงขนาดความเย็น (BTU) ของสินค้าให้เหมือนกันทุกหน้า
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ใส่จุลภาคคั่นหลักพันเสมอ ไม่ขึ้นกับภาษาของเครื่องเซิร์ฟเวอร์
 * กรอกไว้ค่าเดียวก็แสดงค่านั้น ไม่ได้กรอกเลยแสดง "สอบถามขนาด"
 */
const number = new Intl.NumberFormat("en-US");

export function formatBtuRange(min: number | null | undefined, max: number | null | undefined) {
  if (min && max) return min === max ? `${number.format(min)} BTU` : `${number.format(min)}–${number.format(max)} BTU`;
  const single = min || max;
  return single ? `${number.format(single)} BTU` : "สอบถามขนาด";
}
