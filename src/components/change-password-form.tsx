"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";

export function ChangePasswordForm({ mode = "first-sign-in" }: { mode?: "first-sign-in" | "self" }) {
  const self = mode === "self";
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [changed, setChanged] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const rules = useMemo(() => [password.length >= 12, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)], [password]);
  const strength = rules.filter(Boolean).length;
  const canSubmit = strength === rules.length && password === confirm && (!self || currentPassword.length > 0);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!canSubmit) return; setSubmitting(true); setError(""); setChanged(false);
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(self ? { currentPassword, password, confirm } : { password, confirm }) }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { next?: string | null; error?: string } | undefined;
    if (!response?.ok) { setSubmitting(false); setError(result?.error ?? "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่"); return; }
    if (result?.next) { router.replace(result.next); router.refresh(); return; }
    setSubmitting(false); setChanged(true); setCurrentPassword(""); setPassword(""); setConfirm("");
  }
  const labels = ["อย่างน้อย 12 ตัวอักษร", "มีตัวพิมพ์ใหญ่", "มีตัวพิมพ์เล็ก", "มีตัวเลข", "มีอักขระพิเศษ"];
  return <>{!self && <><div className="icon-box"><KeyRound size={22} /></div><p className="eyebrow" style={{ marginTop: 26 }}>FIRST SIGN-IN · STEP 1 OF 3</p><h2 className="heading">ตั้งรหัสผ่านใหม่</h2><p className="muted">รหัสผ่านชั่วคราวใช้ได้ครั้งเดียว กรุณาสร้างรหัสผ่านใหม่ก่อนใช้งานระบบ</p></>}{error && <div className="auth-alert error" role="alert"><AlertCircle size={18} /><div><strong>{error}</strong></div></div>}{changed && <div className="auth-alert success" role="status"><CheckCircle2 size={18} /><div><strong>เปลี่ยนรหัสผ่านแล้ว</strong><p>อุปกรณ์อื่นที่เข้าสู่ระบบด้วยบัญชีนี้ถูกออกจากระบบแล้ว</p></div></div>}<form className="form-stack" onSubmit={submit}>{self && <div className="form-group"><label htmlFor="current-password">รหัสผ่านปัจจุบัน</label><input id="current-password" className="field" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></div>}<div className="form-group"><label htmlFor="new-password">รหัสผ่านใหม่</label><div className="password-field"><input id="new-password" className="field" type={show ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /><button type="button" className="icon-btn" onClick={() => setShow(value => !value)} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><div className="password-meter" aria-label={`ความแข็งแรง ${strength} จาก 5`}>{rules.slice(0, 4).map((met, index) => <span key={index} className={met ? "on" : ""} />)}</div><ul className="requirement-list">{labels.map((label, index) => <li className={rules[index] ? "met" : ""} key={label}><Check size={14} /> {label}</li>)}</ul></div><div className="form-group"><label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label><input id="confirm-password" className="field" type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(confirm && confirm !== password)} />{confirm && confirm !== password && <span style={{ color: "var(--danger)", fontSize: ".76rem" }}>รหัสผ่านไม่ตรงกัน</span>}</div><button className="btn btn-dark" disabled={!canSubmit || submitting}>{submitting ? <><LoaderCircle className="spin" size={18} /> กำลังบันทึก</> : self ? "เปลี่ยนรหัสผ่าน" : <>บันทึกและดำเนินการต่อ <ArrowRight size={17} /></>}</button></form></>;
}
