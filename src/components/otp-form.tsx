/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React otp-form ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, KeyRound, LoaderCircle, RefreshCw } from "lucide-react";
import { setFlashMessage } from "@/lib/client-flash";
import { RecoveryCodes } from "./recovery-codes";

type OtpError = "invalid" | "expired" | "locked";
// ช่องรหัสมีตำแหน่งตายตัว 6 ช่อง ใช้ชื่อช่องเป็น key แทนเลขลำดับ
const DIGIT_SLOTS = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;
const otpErrors: Record<OtpError, { title: string; detail: string }> = {
  locked: { title: "ลองหลายครั้งเกินไป", detail: "ระบบพักการยืนยันชั่วคราว กรุณารอสักครู่แล้วลองใหม่" },
  expired: { title: "รหัสไม่ถูกต้องหรือหมดอายุ", detail: "รอรหัสชุดใหม่แล้วลองอีกครั้ง" },
  invalid: { title: "รหัสไม่ครบหรือไม่ถูกต้อง", detail: "ตรวจสอบรหัสในแอป Authenticator แล้วกรอกใหม่" },
};
function otpError(status: number | undefined): OtpError {
  if (status === 429) return "locked";
  return status === 401 ? "expired" : "invalid";
}

/** สร้างส่วนหน้าจอ OtpForm; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function OtpForm({ setup = false }: Readonly<{ setup?: boolean }>) {
  const router = useRouter();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<OtpError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  function update(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits(current => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    setError(null);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }
  function keyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
  }
  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (value.length === 6) { event.preventDefault(); setDigits(value.split("")); refs.current[5]?.focus(); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) { setError("invalid"); return; }
    setSubmitting(true);
    const response = await fetch(setup ? "/api/auth/2fa/setup/verify" : "/api/auth/2fa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
    if (!response?.ok) { setSubmitting(false); setError(otpError(response?.status)); return; }
    const result = await response.json() as { next: string; recoveryCodes?: string[] };
    if (setup && result.recoveryCodes?.length) {
      setRecoveryCodes(result.recoveryCodes);
      setSubmitting(false);
      return;
    }
    setFlashMessage(setup ? "ตั้งค่า Authenticator สำเร็จแล้ว" : "ยืนยันตัวตนสำเร็จแล้ว");
    router.replace(result.next); router.refresh();
  }
  if (recoveryCodes) {
    return <RecoveryCodes codes={recoveryCodes} onComplete={() => {
      setRecoveryCodes(null);
      setFlashMessage("ตั้งค่า Authenticator สำเร็จแล้ว");
      router.replace("/admin");
      router.refresh();
    }} />;
  }
  return <><div className="icon-box"><KeyRound size={22} /></div><p className="eyebrow" style={{ marginTop: 26 }}>{setup ? "VERIFY AUTHENTICATOR" : "TWO-FACTOR AUTHENTICATION"}</p><h2 className="heading">{setup ? "ยืนยันการตั้งค่า" : "ยืนยันตัวตน"}</h2><p className="muted">กรอกรหัส 6 หลักจากแอป Authenticator รหัสจะเปลี่ยนทุก 30 วินาที</p>{error && <div className="auth-alert error" role="alert"><AlertCircle size={19} /><div><strong>{otpErrors[error].title}</strong><p>{otpErrors[error].detail}</p></div></div>}<form className="form-stack" onSubmit={submit}><fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="sr-only">รหัส OTP 6 หลัก</legend><div className="otp-inputs">{DIGIT_SLOTS.map((slot, index) => <input key={slot} ref={element => { refs.current[index] = element; }} value={digits[index]} onChange={event => update(index, event.target.value)} onKeyDown={event => keyDown(index, event)} onPaste={paste} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} aria-label={`หลักที่ ${index + 1}`} />)}</div></fieldset><button type="submit" className="btn btn-dark" disabled={submitting}>{submitting && <><LoaderCircle className="spin" size={18} /> กำลังยืนยัน</>}{!submitting && <>ยืนยันและดำเนินการต่อ <ArrowRight size={17} /></>}</button></form><button type="button" className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => { setDigits(["", "", "", "", "", ""]); setError(null); refs.current[0]?.focus(); }}><RefreshCw size={16} /> ล้างรหัส</button></>;
}
