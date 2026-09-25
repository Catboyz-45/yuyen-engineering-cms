import { AdminShell } from "@/components/admin-shell";
import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "ระบบจัดการเว็บไซต์", robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) { const { admin } = await requireAdmin(); return <AdminShell user={{ displayName: admin.displayName, username: admin.username, role: admin.role }}>{children}</AdminShell>; }
