import { AuditLog } from "@/components/audit-log";
import { requireAdmin } from "@/server/auth/session";

export default async function AuditPage() {
  await requireAdmin(["SUPER_ADMIN"]);
  return <AuditLog />;
}
