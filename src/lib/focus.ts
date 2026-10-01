/**
 * หน้าที่ของไฟล์นี้: ย้ายโฟกัสในเฟรมถัดไป (หลัง React ถอดเมนูหรือรายการออกแล้ว) โดยไม่แย่งโฟกัสที่ผู้ใช้ย้ายไปที่อื่นแล้ว
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: เฟรมถัดไปอาจมาช้าเมื่อเครื่องทำงานหนัก ระหว่างนั้นผู้ใช้คีย์บอร์ดอาจกด Tab ไปช่องอื่นแล้ว
 * จึงย้ายโฟกัสเฉพาะเมื่อโฟกัสยังอยู่ในส่วนเดิม (scope) หรือหลุดไปที่ body เพราะปุ่มที่โฟกัสอยู่ถูกถอดออกจากหน้า
 * หรืออยู่ที่กรอบที่ครอบส่วนนั้น (Safari ไม่โฟกัสปุ่มที่คลิก แต่โฟกัสกรอบที่กด Tab ได้ซึ่งครอบปุ่มอยู่ เช่นกรอบตาราง)
 */
/** โฟกัสยังเป็นของส่วนนี้: อยู่ข้างใน, อยู่ที่ body (ปุ่มเดิมถูกถอดออก) หรืออยู่ที่กรอบที่ครอบส่วนนี้ (Safari ตอนคลิกปุ่ม) */
export function focusIsAround(scope: HTMLElement | null | undefined) {
  const active = document.activeElement;
  return !active || active === document.body || Boolean(scope && (scope.contains(active) || active.contains(scope)));
}

export function focusNextFrame(
  target: () => HTMLElement | null | undefined,
  scope: () => HTMLElement | null | undefined,
  options?: FocusOptions,
) {
  return window.requestAnimationFrame(() => {
    if (focusIsAround(scope())) target()?.focus(options);
  });
}
