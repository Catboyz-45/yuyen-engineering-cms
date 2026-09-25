"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Edit3, KeyRound, MoreHorizontal, RotateCcw, ShieldCheck, ShieldOff, Trash2, UserPlus, X } from "lucide-react";
import { AdminPageHeader } from "./admin-shell";

type Role = "SUPER_ADMIN" | "EDITOR";
type AdminUser = { id: string; displayName: string; username: string; role: Role; isActive: boolean; twoFactorEnabled: boolean; deletedAt: string | null; purgeAt: string | null };
type UsersResponse = { users: AdminUser[]; currentUserId: string };
type DialogState = { type: "create" | "edit" | "password" | "twoFactor" | "disable" | "trash" | "restore" | "purge"; user?: AdminUser } | null;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "ไม่สามารถดำเนินการได้");
  return body;
}

export function AdminAccounts() {
  const [allUsers, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const users = allUsers.filter(user => !user.deletedAt);
  const trashedUsers = allUsers.filter(user => user.deletedAt);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const activeSuperAdmins = users.filter(user => user.isActive && user.role === "SUPER_ADMIN").length;

  const loadUsers = useCallback(async () => {
    try {
      const result = await api<UsersResponse>("/api/admin/users");
      setUsers(result.users); setCurrentUserId(result.currentUserId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void api<UsersResponse>("/api/admin/users")
      .then(result => { if (active) { setUsers(result.users); setCurrentUserId(result.currentUserId); } })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3200); }
  function openDialog(next: DialogState) { setError(""); setTemporaryPassword(""); setPurgeConfirmation(""); setDialog(next); }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const displayName = String(data.get("displayName"));
    const role = String(data.get("role")) as Role;
    setSubmitting(true); setError("");
    try {
      if (dialog?.type === "edit" && dialog.user) {
        await api(`/api/admin/users/${dialog.user.id}`, { method: "PATCH", body: JSON.stringify({ displayName, role }) });
        setDialog(null); notify("บันทึกข้อมูลผู้ดูแลแล้ว");
      } else {
        const result = await api<{ temporaryPassword: string }>("/api/admin/users", { method: "POST", body: JSON.stringify({ displayName, username: String(data.get("username")), role }) });
        setTemporaryPassword(result.temporaryPassword); notify("สร้างบัญชีแล้ว โปรดส่งรหัสผ่านชั่วคราวผ่านช่องทางที่ปลอดภัย");
      }
      await loadUsers();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ"); }
    finally { setSubmitting(false); }
  }

  async function confirmAction() {
    if (!dialog?.user) return;
    setSubmitting(true); setError("");
    try {
      if (dialog.type === "password") {
        const result = await api<{ temporaryPassword: string }>(`/api/admin/users/${dialog.user.id}/reset-password`, { method: "POST", body: "{}" });
        setTemporaryPassword(result.temporaryPassword);
        notify("รีเซ็ตรหัสผ่านและยกเลิก session เดิมแล้ว");
      } else if (dialog.type === "twoFactor") {
        await api(`/api/admin/users/${dialog.user.id}/reset-2fa`, { method: "POST", body: "{}" });
        setDialog(null); notify("รีเซ็ต 2FA แล้ว ผู้ใช้ต้องตั้งค่าใหม่เมื่อเข้าสู่ระบบ");
      } else if (dialog.type === "trash" || dialog.type === "restore" || dialog.type === "purge") {
        await api(`/api/admin/users/${dialog.user.id}/transition`, { method: "POST", body: JSON.stringify({ action: dialog.type === "purge" ? "delete" : dialog.type }) });
        setDialog(null); notify(dialog.type === "trash" ? "ย้ายบัญชีไปถังขยะและยกเลิก session แล้ว" : dialog.type === "restore" ? "กู้คืนบัญชีแล้ว บัญชียังปิดใช้งานอยู่จนกว่าจะเปิดใช้งาน" : "ลบบัญชีถาวรแล้ว");
      } else {
        await api(`/api/admin/users/${dialog.user.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !dialog.user.isActive }) });
        setDialog(null); notify("เปลี่ยนสถานะบัญชีและยกเลิก session เดิมแล้ว");
      }
      await loadUsers();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setSubmitting(false); }
  }

  return <>
    <AdminPageHeader title="ผู้ดูแลระบบ" description="เพิ่มบัญชี กำหนดบทบาท รีเซ็ตข้อมูลความปลอดภัย และจัดการการเข้าถึง" action={<button className="btn btn-dark" onClick={() => openDialog({ type: "create" })}><UserPlus size={17} /> เพิ่มผู้ดูแล</button>} />
    {notice && <div className="toast" role="status"><CheckCircle2 size={19} /> {notice}</div>}
    {error && !dialog && <div className="auth-alert warning" role="alert">{error}</div>}
    <section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>ผู้ดูแล</th><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>2FA</th><th>สถานะ</th><th /></tr></thead><tbody>
      {loading && <tr><td colSpan={6}>กำลังโหลด…</td></tr>}
      {!loading && users.length === 0 && <tr><td colSpan={6}>ยังไม่มีบัญชีผู้ดูแล</td></tr>}
      {users.map(user => { const isLastSuperAdmin = user.role === "SUPER_ADMIN" && user.isActive && activeSuperAdmins === 1; const isSelf = user.id === currentUserId; return <tr key={user.id}><td><div className="cluster"><span className="avatar">{user.displayName[0]}</span><strong>{user.displayName}</strong></div></td><td>{user.username}</td><td><span className="tag">{user.role === "SUPER_ADMIN" ? "Super Admin" : "Editor"}</span></td><td><span className={`status ${user.twoFactorEnabled ? "" : "draft"}`}>{user.twoFactorEnabled ? <ShieldCheck size={13} /> : <ShieldOff size={13} />} {user.twoFactorEnabled ? "เปิดใช้งาน" : "รอตั้งค่า"}</span></td><td><span className={`status ${user.isActive ? "" : "draft"}`}>{user.isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}</span></td><td><div className="row-actions"><button className="icon-btn" onClick={() => openDialog({ type: "edit", user })} aria-label={`แก้ไข ${user.displayName}`}><Edit3 size={16} /></button><button className="icon-btn" onClick={() => openDialog({ type: "password", user })} aria-label={`รีเซ็ตรหัสผ่าน ${user.displayName}`}><KeyRound size={16} /></button><div className="account-menu"><button className="icon-btn" aria-label={`เมนู ${user.displayName}`}><MoreHorizontal size={17} /></button><div className="account-menu-items"><button onClick={() => openDialog({ type: "twoFactor", user })} disabled={!user.twoFactorEnabled}>รีเซ็ต 2FA</button><button onClick={() => openDialog({ type: "disable", user })} disabled={isLastSuperAdmin || isSelf}>{user.isActive ? "ปิดใช้งานบัญชี" : "เปิดใช้งานบัญชี"}</button><button onClick={() => openDialog({ type: "trash", user })} disabled={isLastSuperAdmin || isSelf}>ย้ายไปถังขยะ</button></div></div></div>{isLastSuperAdmin ? <span className="muted" style={{ fontSize: ".68rem" }}>Super Admin คนสุดท้าย</span> : isSelf && <span className="muted" style={{ fontSize: ".68rem" }}>บัญชีของคุณ</span>}</td></tr>; })}
    </tbody></table></div></section>
    {trashedUsers.length > 0 && <section className="panel"><div className="panel-header"><h2>บัญชีในถังขยะ</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>ผู้ดูแล</th><th>ชื่อผู้ใช้</th><th>ลบถาวรอัตโนมัติ</th><th /></tr></thead><tbody>
      {trashedUsers.map(user => <tr key={user.id}><td><strong>{user.displayName}</strong></td><td>{user.username}</td><td>{user.purgeAt ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(user.purgeAt)) : "-"}</td><td><div className="row-actions"><button className="btn btn-outline" onClick={() => openDialog({ type: "restore", user })}><RotateCcw size={15} /> กู้คืน</button><button className="icon-btn" onClick={() => openDialog({ type: "purge", user })} aria-label={`ลบบัญชี ${user.displayName} ถาวร`}><Trash2 size={16} /></button></div></td></tr>)}
    </tbody></table></div></section>}
    <div className="auth-alert warning" style={{ maxWidth: 680 }}><ShieldCheck size={18} /><div><strong>ระบบป้องกัน Super Admin คนสุดท้าย</strong><p>ไม่สามารถปิดใช้งาน ลดสิทธิ์ หรือย้ายบัญชี Super Admin คนสุดท้ายไปถังขยะได้ และไม่สามารถเปลี่ยนบทบาทหรือสถานะของบัญชีตัวเอง</p></div></div>
    {dialog && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !submitting) setDialog(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="panel-header"><h2 id="dialog-title">{dialog.type === "create" ? "เพิ่มผู้ดูแล" : dialog.type === "edit" ? "แก้ไขผู้ดูแล" : dialog.type === "password" ? "รีเซ็ตรหัสผ่าน" : dialog.type === "twoFactor" ? "รีเซ็ต 2FA" : dialog.type === "trash" ? "ย้ายบัญชีไปถังขยะ" : dialog.type === "restore" ? "กู้คืนบัญชี" : dialog.type === "purge" ? "ลบบัญชีถาวร" : dialog.user?.isActive ? "ปิดใช้งานบัญชี" : "เปิดใช้งานบัญชี"}</h2><button className="icon-btn" onClick={() => setDialog(null)} disabled={submitting} aria-label="ปิด"><X size={19} /></button></div>
      {error && <div className="auth-alert warning" role="alert">{error}</div>}
      {temporaryPassword ? <div className="card-body form-stack"><p>รหัสผ่านชั่วคราวจะแสดงเพียงครั้งเดียว ผู้ใช้จะถูกบังคับให้เปลี่ยนเมื่อเข้าสู่ระบบ</p><label htmlFor="temporary-password">รหัสผ่านชั่วคราว</label><input id="temporary-password" className="field" value={temporaryPassword} readOnly autoFocus /><button className="btn btn-dark" onClick={() => { setTemporaryPassword(""); setDialog(null); }}>รับทราบและปิด</button></div> : (dialog.type === "create" || dialog.type === "edit") ? <form className="card-body form-stack" onSubmit={submitUser}><div className="form-group"><label htmlFor="admin-name">ชื่อที่แสดง</label><input id="admin-name" name="displayName" className="field" defaultValue={dialog.user?.displayName} required autoFocus /></div><div className="form-group"><label htmlFor="admin-username">ชื่อผู้ใช้</label><input id="admin-username" name="username" className="field" defaultValue={dialog.user?.username} minLength={3} pattern="[a-zA-Z0-9._-]+" required disabled={dialog.type === "edit"} /></div><div className="form-group"><label htmlFor="admin-role">บทบาท</label><select id="admin-role" name="role" className="select" defaultValue={dialog.user?.role ?? "EDITOR"} disabled={Boolean((dialog.user?.role === "SUPER_ADMIN" && activeSuperAdmins === 1) || (dialog.user && dialog.user.id === currentUserId))}><option value="EDITOR">Editor</option><option value="SUPER_ADMIN">Super Admin</option></select>{dialog.user?.role === "SUPER_ADMIN" && activeSuperAdmins === 1 && <span className="muted" style={{ fontSize: ".73rem" }}>เพิ่ม Super Admin อีกคนก่อนจึงจะลดสิทธิ์บัญชีนี้ได้</span>}</div><button className="btn btn-dark" disabled={submitting}>{submitting ? "กำลังบันทึก…" : "บันทึก"}</button></form> : <div className="card-body"><p>{dialog.type === "password" ? `ระบบจะสร้างรหัสผ่านชั่วคราวให้ ${dialog.user?.displayName} บังคับเปลี่ยนรหัสผ่านครั้งถัดไป และยกเลิก session เดิมทั้งหมด` : dialog.type === "twoFactor" ? `TOTP secret และ Recovery Codes เดิมของ ${dialog.user?.displayName} จะใช้ไม่ได้ และต้องตั้งค่าใหม่เมื่อเข้าสู่ระบบ` : dialog.type === "trash" ? `${dialog.user?.displayName} จะออกจากระบบทันทีและเข้าสู่ระบบไม่ได้ บัญชีจะถูกลบถาวรเมื่อครบ 30 วัน และกู้คืนได้ก่อนหน้านั้น` : dialog.type === "restore" ? `บัญชี ${dialog.user?.displayName} จะกลับมาในสถานะปิดใช้งาน ต้องเปิดใช้งานอีกครั้งก่อนเข้าสู่ระบบ` : dialog.type === "purge" ? `ชื่อ ชื่อผู้ใช้ รหัสผ่าน และ 2FA ของ ${dialog.user?.displayName} จะถูกลบถาวร ประวัติ audit ยังคงอยู่แต่แสดงเป็นผู้ดูแลที่ถูกลบ การดำเนินการนี้ย้อนกลับไม่ได้` : `ยืนยันการเปลี่ยนสถานะบัญชี ${dialog.user?.displayName}`}</p>{dialog.type === "purge" && <div className="form-group" style={{ marginTop: 16 }}><label htmlFor="purge-confirmation">พิมพ์ชื่อผู้ใช้ “{dialog.user?.username}” เพื่อยืนยัน</label><input id="purge-confirmation" className="field" value={purgeConfirmation} onChange={event => setPurgeConfirmation(event.target.value)} autoComplete="off" /></div>}<div className="cluster" style={{ justifyContent: "end", marginTop: 24 }}><button className="btn btn-outline" onClick={() => setDialog(null)} disabled={submitting}>ยกเลิก</button><button className={`btn ${dialog.type === "purge" || dialog.type === "trash" ? "btn-danger" : "btn-dark"}`} onClick={confirmAction} disabled={submitting || (dialog.type === "purge" && purgeConfirmation !== dialog.user?.username)}>{submitting ? "กำลังดำเนินการ…" : "ยืนยัน"}</button></div></div>}
    </section></div>}
  </>;
}
