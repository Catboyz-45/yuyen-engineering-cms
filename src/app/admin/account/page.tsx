import { AdminPageHeader } from "@/components/admin-shell";
import { ChangePasswordForm } from "@/components/change-password-form";
import { requireAdmin } from "@/server/auth/session";

export default async function AccountPage() {
  const session = await requireAdmin();
  return <><AdminPageHeader title="บัญชีของฉัน" description={`${session.admin.displayName} · ${session.admin.username} · ${session.admin.role === "SUPER_ADMIN" ? "Super Admin" : "Editor"}`} /><section className="panel" style={{ maxWidth: 560 }}><div className="panel-header"><h2>เปลี่ยนรหัสผ่าน</h2></div><div className="card-body"><ChangePasswordForm mode="self" /></div></section></>;
}
