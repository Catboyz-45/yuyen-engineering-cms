/**
 * หน้าที่ของไฟล์นี้: ตรวจเลขทะเบียนนิติบุคคลไทย 13 หลัก
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: หลักสุดท้ายเป็นเลขตรวจสอบที่คำนวณจาก 12 หลักแรก จึงจับเลขที่พิมพ์ผิดได้เกือบทุกกรณี
 */

/** true เมื่อเป็นตัวเลข 13 หลักและหลักสุดท้ายตรงกับเลขตรวจสอบ (วิธีเดียวกับเลขประจำตัวผู้เสียภาษี) */
export function isValidRegistrationNumber(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === digits[12];
}
