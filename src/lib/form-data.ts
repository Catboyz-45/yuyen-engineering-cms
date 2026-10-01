/**
 * หน้าที่ของไฟล์นี้: อ่านค่าข้อความจากฟอร์มอย่างปลอดภัย ช่องที่เป็นไฟล์หรือไม่มีอยู่จะได้ข้อความว่างแทน "[object File]"
 */

/** ค่าข้อความของช่อง `name`; ถ้าไม่มีช่องนี้หรือเป็นไฟล์จะคืน "" */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
