/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React admin-accounts ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Edit3, KeyRound, ShieldCheck, ShieldOff, UserPlus, X } from "lucide-react";
import { AdminPageHeader } from "./admin-shell";
import { ThemeSelect } from "./theme-select";
import { AccountActionsMenu } from "./admin/account-actions-menu";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import { formText } from "@/lib/form-data";

type Role = "SUPER_ADMIN" | "EDITOR";
type AdminUser = { id: string; displayName: string; username: string; role: Role; isActive: boolean; twoFactorEnabled: boolean; deletedAt?: string | null };
// บัญชีในถังขยะจัดการที่หน้าถังขยะ ตารางนี้แสดงเฉพาะบัญชีที่ใช้งานได้
type UsersResponse = { users: AdminUser[]; currentUserId: string };
const liveUsers = (result: UsersResponse) => result.users.filter(user => !user.deletedAt);
type DialogState = { type: "create" | "edit" | "resetPassword" | "twoFactor" | "disable" | "trash"; user?: AdminUser } | null;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "ไม่สามารถดำเนินการได้");
  return body;
}

type DialogType = NonNullable<DialogState>["type"];
type ActionResult = { message: string; temporaryPassword?: string };

const roleLabels: Record<Role, string> = { SUPER_ADMIN: "Super Admin", EDITOR: "Editor" };
const hintStyle = { fontSize: ".73rem" };
const noteStyle = { fontSize: ".68rem" };

const errorMessage = (value: unknown, fallback: string) => (value instanceof Error ? value.message : fallback);

function dialogTitle(dialog: NonNullable<DialogState>) {
  switch (dialog.type) {
    case "create":
      return "เพิ่มผู้ดูแล";
    case "edit":
      return "แก้ไขผู้ดูแล";
    case "resetPassword":
      return "รีเซ็ตรหัสผ่าน";
    case "twoFactor":
      return "รีเซ็ต 2FA";
    case "trash":
      return "ย้ายบัญชีลงถังขยะ";
    default:
      return dialog.user?.isActive ? "ปิดใช้งานบัญชี" : "เปิดใช้งานบัญชี";
  }
}

function confirmMessage(dialog: NonNullable<DialogState>) {
  const name = dialog.user?.displayName;
  switch (dialog.type) {
    case "resetPassword":
      return `ระบบจะสร้างรหัสผ่านชั่วคราวให้ ${name} บังคับเปลี่ยนรหัสผ่านครั้งถัดไป และยกเลิก session เดิมทั้งหมด`;
    case "twoFactor":
      return `TOTP secret และ Recovery Codes เดิมของ ${name} จะใช้ไม่ได้ และต้องตั้งค่าใหม่เมื่อเข้าสู่ระบบ`;
    case "trash":
      return `บัญชี ${name} จะเข้าสู่ถังขยะเป็นเวลา 30 วัน ถูกปิดใช้งาน และ session ทั้งหมดจะถูกยกเลิก`;
    default:
      return `ยืนยันการเปลี่ยนสถานะบัญชี ${name}`;
  }
}

/** เหตุผลที่ล็อกบทบาทหรือสถานะของบัญชี ใช้ทั้งในตารางและในฟอร์ม */
function lockReason(isSelf: boolean, isLastSuperAdmin: boolean, inForm: boolean) {
  if (isSelf) return inForm ? "เปลี่ยนบทบาทของบัญชีตัวเองไม่ได้ ให้ Super Admin คนอื่นเปลี่ยนให้" : "บัญชีของคุณ";
  if (isLastSuperAdmin) return inForm ? "เพิ่ม Super Admin อีกคนก่อนจึงจะลดสิทธิ์บัญชีนี้ได้" : "Super Admin คนสุดท้าย";
  return null;
}

/** เรียก API ของการกระทำที่ต้องยืนยัน แล้วคืนข้อความแจ้งผล (และรหัสผ่านชั่วคราวถ้ามี) */
async function runAccountAction(type: DialogType, user: AdminUser): Promise<ActionResult> {
  switch (type) {
    case "resetPassword": {
      const result = await api<{ temporaryPassword: string }>(`/api/admin/users/${user.id}/reset-password`, { method: "POST", body: "{}" });
      return { message: "รีเซ็ตรหัสผ่านและยกเลิก session เดิมแล้ว", temporaryPassword: result.temporaryPassword };
    }
    case "twoFactor":
      await api(`/api/admin/users/${user.id}/reset-2fa`, { method: "POST", body: "{}" });
      return { message: "รีเซ็ต 2FA แล้ว ผู้ใช้ต้องตั้งค่าใหม่เมื่อเข้าสู่ระบบ" };
    case "disable":
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !user.isActive }) });
      return { message: "เปลี่ยนสถานะบัญชีและยกเลิก session เดิมแล้ว" };
    default:
      await api(`/api/admin/users/${user.id}/transition`, { method: "POST", body: JSON.stringify({ action: "trash" }) });
      return { message: "ย้ายบัญชีลงถังขยะและยกเลิก session เดิมแล้ว" };
  }
}

/** บันทึกฟอร์มผู้ดูแล: แก้ไขบัญชีเดิม หรือสร้างบัญชีใหม่แล้วคืนรหัสผ่านชั่วคราว */
async function saveUser(editing: AdminUser | undefined, data: FormData): Promise<ActionResult> {
  const displayName = formText(data, "displayName");
  const role = formText(data, "role") as Role;
  if (editing) {
    // ส่งบทบาทเฉพาะเมื่อเปลี่ยนจริง: การส่งบทบาทจะยกเลิก session ของผู้ใช้นั้น จึงไม่ควรเกิดตอนแก้แค่ชื่อที่แสดง
    const roleChange = role === editing.role ? {} : { role };
    await api(`/api/admin/users/${editing.id}`, { method: "PATCH", body: JSON.stringify({ displayName, ...roleChange }) });
    return { message: "บันทึกข้อมูลผู้ดูแลแล้ว" };
  }
  const result = await api<{ temporaryPassword: string }>("/api/admin/users", { method: "POST", body: JSON.stringify({ displayName, username: formText(data, "username"), role }) });
  return { message: "สร้างบัญชีแล้ว โปรดส่งรหัสผ่านชั่วคราวผ่านช่องทางที่ปลอดภัย", temporaryPassword: result.temporaryPassword };
}

/** สร้างส่วนหน้าจอ AdminAccounts; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AdminAccounts() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogOpenerRef = useRef<HTMLElement>(null);
  const activeSuperAdmins = users.filter(user => user.isActive && user.role === "SUPER_ADMIN").length;

  const loadUsers = useCallback(async () => {
    try {
      const result = await api<UsersResponse>("/api/admin/users");
      setUsers(liveUsers(result));
      setCurrentUserId(result.currentUserId);
    } catch (caughtError) {
      setError(errorMessage(caughtError, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api<UsersResponse>("/api/admin/users")
      .then(result => { if (active) { setUsers(liveUsers(result)); setCurrentUserId(result.currentUserId); } })
      .catch(caughtError => { if (active) setError(errorMessage(caughtError, "โหลดข้อมูลไม่สำเร็จ")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3200); }
  const closeDialog = useCallback(() => { if (!submitting) setDialog(null); }, [submitting]);
  useModalAccessibility({ active: Boolean(dialog), containerRef: dialogRef, backdropRef, restoreFocusRef: dialogOpenerRef, onClose: closeDialog, closeDisabled: submitting });
  function openDialog(next: DialogState) {
    dialogOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError(""); setTemporaryPassword(""); setDialog(next);
  }
  /** แสดงผลหลังบันทึกสำเร็จ: มีรหัสผ่านชั่วคราวก็เปิดหน้าต่างค้างไว้ให้คัดลอก ไม่มีก็ปิดหน้าต่าง */
  async function finish(result: ActionResult) {
    if (result.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
    else setDialog(null);
    notify(result.message);
    await loadUsers();
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true); setError("");
    try {
      await finish(await saveUser(dialog?.type === "edit" ? dialog.user : undefined, data));
    } catch (caughtError) {
      setError(errorMessage(caughtError, "บันทึกไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmAction() {
    if (!dialog?.user) return;
    setSubmitting(true); setError("");
    try {
      await finish(await runAccountAction(dialog.type, dialog.user));
    } catch (caughtError) {
      setError(errorMessage(caughtError, "ดำเนินการไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <AdminPageHeader eyebrow="ความปลอดภัย" title="ผู้ดูแลระบบ" description="เพิ่มบัญชี กำหนดบทบาท รีเซ็ตข้อมูลความปลอดภัย และจัดการการเข้าถึง" action={<button type="button" className="btn btn-dark" onClick={() => openDialog({ type: "create" })}><UserPlus size={17} /> เพิ่มผู้ดูแล</button>} />
    {notice && <output className="toast"><CheckCircle2 size={19} /> {notice}</output>}
    {error && !dialog && <div className="auth-alert warning" role="alert">{error}</div>}
    <section className="panel"><div className="table-wrap"><table className="data-table" aria-busy={loading}><thead><tr><th>ผู้ดูแล</th><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>ยืนยัน 2 ขั้นตอน</th><th>สถานะ</th><th><span className="sr-only">การจัดการ</span></th></tr></thead><tbody>
      {loading && [150, 100, 90].map(width => <tr key={width} className="skeleton-row"><td><span className="skeleton" style={{ width }} /></td><td><span className="skeleton" style={{ width: 100 }} /></td><td><span className="skeleton" style={{ width: 90 }} /></td><td><span className="skeleton" style={{ width: 90 }} /></td><td><span className="skeleton" style={{ width: 80 }} /></td><td /></tr>)}
      {!loading && users.length === 0 && <tr><td colSpan={6}>ยังไม่มีบัญชีผู้ดูแล</td></tr>}
      {users.map(user => <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} isLastSuperAdmin={user.role === "SUPER_ADMIN" && user.isActive && activeSuperAdmins === 1} onOpen={openDialog} />)}
    </tbody></table></div></section>
    <div className="info-note"><ShieldCheck size={18} aria-hidden="true" /><div><strong>ระบบป้องกัน Super Admin คนสุดท้าย</strong><p>ไม่สามารถปิดใช้งาน ลดสิทธิ์ หรือย้ายบัญชี Super Admin คนสุดท้ายไปถังขยะได้ และเปลี่ยนบทบาทหรือสถานะของบัญชีตัวเองไม่ได้</p></div></div>
    {dialog && <div ref={backdropRef} className="modal-backdrop"><dialog open ref={dialogRef} className="modal-card" aria-modal="true" aria-labelledby="dialog-title" aria-busy={submitting} tabIndex={-1}><div className="panel-header"><h2 id="dialog-title">{dialogTitle(dialog)}</h2><button type="button" className="icon-btn" onClick={closeDialog} disabled={submitting} aria-label="ปิด"><X size={19} /></button></div>
      {error && <div className="auth-alert warning" role="alert">{error}</div>}
      <AccountDialogBody dialog={dialog} temporaryPassword={temporaryPassword} submitting={submitting} currentUserId={currentUserId} activeSuperAdmins={activeSuperAdmins} onSubmitUser={submitUser} onConfirm={confirmAction} onDone={() => { setTemporaryPassword(""); setDialog(null); }} onCancel={() => setDialog(null)} />
    </dialog></div>}
  </>;
}

function UserRow({ user, isSelf, isLastSuperAdmin, onOpen }: Readonly<{ user: AdminUser; isSelf: boolean; isLastSuperAdmin: boolean; onOpen: (next: DialogState) => void }>) {
  const locked = isLastSuperAdmin || isSelf;
  const note = lockReason(isSelf, isLastSuperAdmin, false);
  return <tr>
    <td><div className="cluster"><span className="avatar" aria-hidden="true">{user.displayName[0]}</span><strong>{user.displayName}</strong></div></td>
    <td>{user.username}</td>
    <td><span className="tag">{roleLabels[user.role]}</span></td>
    <td><span className={`status ${user.twoFactorEnabled ? "" : "draft"}`}>{user.twoFactorEnabled ? <ShieldCheck size={13} /> : <ShieldOff size={13} />} {user.twoFactorEnabled ? "เปิดใช้งาน" : "รอตั้งค่า"}</span></td>
    <td><span className={`status ${user.isActive ? "" : "draft"}`}>{user.isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}</span></td>
    <td>
      <div className="row-actions">
        <button type="button" className="icon-btn" onClick={() => onOpen({ type: "edit", user })} aria-label={`แก้ไข ${user.displayName}`}><Edit3 size={16} /></button>
        <button type="button" className="icon-btn" onClick={() => onOpen({ type: "resetPassword", user })} aria-label={`รีเซ็ตรหัสผ่าน ${user.displayName}`}><KeyRound size={16} /></button>
        <AccountActionsMenu userName={user.displayName} actions={[
          { label: "รีเซ็ต 2FA", disabled: !user.twoFactorEnabled, onSelect: () => onOpen({ type: "twoFactor", user }) },
          { label: user.isActive ? "ปิดใช้งานบัญชี" : "เปิดใช้งานบัญชี", disabled: locked, onSelect: () => onOpen({ type: "disable", user }) },
          { label: "ย้ายลงถังขยะ", disabled: locked, onSelect: () => onOpen({ type: "trash", user }) },
        ]} />
      </div>
      {note && <span className="muted" style={noteStyle}>{note}</span>}
    </td>
  </tr>;
}

type DialogBodyProps = Readonly<{
  dialog: NonNullable<DialogState>;
  temporaryPassword: string;
  submitting: boolean;
  currentUserId: string;
  activeSuperAdmins: number;
  onSubmitUser: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onDone: () => void;
  onCancel: () => void;
}>;

function AccountDialogBody({ dialog, temporaryPassword, submitting, currentUserId, activeSuperAdmins, onSubmitUser, onConfirm, onDone, onCancel }: DialogBodyProps) {
  if (temporaryPassword) {
    return <div className="card-body form-stack"><p>รหัสผ่านชั่วคราวจะแสดงเพียงครั้งเดียว ผู้ใช้จะถูกบังคับให้เปลี่ยนเมื่อเข้าสู่ระบบ</p><label htmlFor="temporary-password">รหัสผ่านชั่วคราว</label><input id="temporary-password" className="field" value={temporaryPassword} readOnly autoFocus /><button type="button" className="btn btn-dark" onClick={onDone}>รับทราบและปิด</button></div>;
  }
  if (dialog.type === "create" || dialog.type === "edit") {
    const isSelf = dialog.user?.id === currentUserId;
    const isLastSuperAdmin = dialog.user?.role === "SUPER_ADMIN" && activeSuperAdmins === 1;
    const hint = lockReason(isSelf, isLastSuperAdmin, true);
    return <form className="card-body form-stack" onSubmit={onSubmitUser}>
      <div className="form-group"><label htmlFor="admin-name">ชื่อที่แสดง</label><input id="admin-name" name="displayName" className="field" defaultValue={dialog.user?.displayName} required autoFocus /></div>
      <div className="form-group"><label htmlFor="admin-username">ชื่อผู้ใช้</label><input id="admin-username" name="username" className="field" defaultValue={dialog.user?.username} minLength={3} pattern="[a-zA-Z0-9._-]+" required disabled={dialog.type === "edit"} /></div>
      <div className="form-group"><label htmlFor="admin-role">บทบาท</label><ThemeSelect id="admin-role" name="role" label="บทบาท" defaultValue={dialog.user?.role ?? "EDITOR"} disabled={Boolean(dialog.user && hint)} options={[{ value: "EDITOR", label: "Editor — จัดการเนื้อหา" }, { value: "SUPER_ADMIN", label: "Super Admin — จัดการเนื้อหาและผู้ดูแล" }]} />{hint && <span className="muted" style={hintStyle}>{hint}</span>}</div>
      <button type="submit" className="btn btn-dark" disabled={submitting}>{submitting ? "กำลังบันทึก…" : "บันทึก"}</button>
    </form>;
  }
  return <div className="card-body"><p>{confirmMessage(dialog)}</p><div className="cluster" style={{ justifyContent: "end", marginTop: 24 }}><button type="button" className="btn btn-outline" onClick={onCancel} disabled={submitting}>ยกเลิก</button><button type="button" className="btn btn-dark" onClick={onConfirm} disabled={submitting}>{submitting ? "กำลังดำเนินการ…" : "ยืนยัน"}</button></div></div>;
}
