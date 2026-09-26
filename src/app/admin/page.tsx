/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin (ภาพรวม) แสดงทางลัดเริ่มงาน จำนวนเนื้อหาแต่ละประเภท สถานะเนื้อหา และกิจกรรมล่าสุด
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: Editor เห็นเฉพาะกิจกรรมของตัวเอง Super Admin เห็นกิจกรรมของทุกคน
 */
import Link from "next/link";
import { ArrowUpRight, Boxes, BriefcaseBusiness, Building2, ExternalLink, HardDrive, History, Newspaper, Package, Plus } from "lucide-react";
import { AdminPageHeader, SecurityNote } from "@/components/admin-shell";
import { auditLabel } from "@/lib/audit-labels";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";

const size = (bytes: bigint) => bytes < 1024 * 1024 ? `${(Number(bytes) / 1024).toFixed(1)} KB` : `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const today = new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeZone: "Asia/Bangkok" });

const quickActions = [
  { href: "/admin/products/new", label: "เพิ่มสินค้า", icon: Package },
  { href: "/admin/projects/new", label: "เพิ่มผลงาน", icon: Boxes },
  { href: "/admin/news/new", label: "เขียนข่าวสาร", icon: Newspaper },
  { href: "/admin/company", label: "แก้ข้อมูลบริษัท", icon: Building2 },
] as const;

type CountWhere = { status?: "PUBLISHED" | "DRAFT"; deletedAt: null | { not: null } };

/** นับเนื้อหาของตารางหนึ่งแยกตามสถานะ โดยไม่นับรายการในถังขยะเป็นเนื้อหาปัจจุบัน */
async function countContent(count: (where: CountWhere) => Promise<number>) {
  const [total, published, drafts, trashed] = await Promise.all([
    count({ deletedAt: null }),
    count({ status: "PUBLISHED", deletedAt: null }),
    count({ status: "DRAFT", deletedAt: null }),
    count({ deletedAt: { not: null } }),
  ]);
  return { total, published, drafts, trashed };
}

/** สร้างส่วนหน้าจอ DashboardPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function DashboardPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.admin.role === "SUPER_ADMIN";
  const [services, products, projects, news, activities, mediaOriginals, mediaDerivatives] = await Promise.all([
    countContent(where => db.service.count({ where })), countContent(where => db.product.count({ where })),
    countContent(where => db.project.count({ where })), countContent(where => db.news.count({ where })),
    db.auditLog.findMany({ where: isSuperAdmin ? {} : { actorId: session.adminId }, select: { id: true, action: true, targetType: true, result: true, createdAt: true, actor: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.media.aggregate({ where: { status: "READY", kind: "PDF", deletedAt: null }, _sum: { sizeBytes: true } }),
    db.mediaVariant.aggregate({ where: { media: { status: "READY", deletedAt: null } }, _sum: { sizeBytes: true } }),
  ]);
  const metrics = [
    { href: "/admin/services", label: "บริการ", icon: BriefcaseBusiness, ...services },
    { href: "/admin/products", label: "สินค้า", icon: Package, ...products },
    { href: "/admin/projects", label: "ผลงาน", icon: Boxes, ...projects },
    { href: "/admin/news", label: "ข่าวสาร", icon: Newspaper, ...news },
  ];
  const sum = (key: "published" | "drafts" | "trashed") => metrics.reduce((total, item) => total + item[key], 0);
  const statuses = [
    { label: "เผยแพร่แล้ว", value: sum("published"), tone: "published" },
    { label: "ฉบับร่าง", value: sum("drafts"), tone: "draft" },
    { label: "ในถังขยะ", value: sum("trashed"), tone: "trash" },
  ];
  const statusTotal = statuses.reduce((total, item) => total + item.value, 0);
  const mediaBytes = (mediaOriginals._sum.sizeBytes ?? BigInt(0)) + (mediaDerivatives._sum.sizeBytes ?? BigInt(0));

  return (
    <>
      <AdminPageHeader
        eyebrow="ภาพรวม"
        title={`สวัสดี, ${session.admin.displayName}`}
        description={`ข้อมูลเว็บไซต์ ณ ${today.format(new Date())}`}
        action={<a className="btn btn-outline" href="/" target="_blank" rel="noreferrer"><ExternalLink size={16} /> ดูหน้าเว็บ</a>}
      />

      <section className="dash-hero" aria-labelledby="dash-hero-title">
        <div className="dash-hero-copy">
          <p className="eyebrow">เริ่มงานได้เลย</p>
          <h2 id="dash-hero-title">อัปเดตเว็บไซต์บริษัทได้ในไม่กี่ขั้นตอน</h2>
          <p>เพิ่มหรือแก้ไขเนื้อหา กดเผยแพร่ แล้วหน้าเว็บจะแสดงผลทันที</p>
        </div>
        <nav className="dash-actions" aria-label="ทางลัด">
          {quickActions.map(item => (
            <Link key={item.href} href={item.href} className="dash-action">
              <item.icon size={19} aria-hidden="true" />
              <span>{item.label}</span>
              {item.href.endsWith("/new") ? <Plus size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}
            </Link>
          ))}
        </nav>
      </section>

      <div className="metric-grid">
        {metrics.map(item => (
          <Link className="card metric-card" href={item.href} key={item.href}>
            <span className="icon-box"><item.icon size={20} aria-hidden="true" /></span>
            <div>
              <p>{item.label}ทั้งหมด</p>
              <strong>{item.total}</strong>
              <small>เผยแพร่ {item.published} · ฉบับร่าง {item.drafts}</small>
            </div>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="panel" aria-labelledby="activity-title">
          <div className="panel-header">
            <h2 id="activity-title">กิจกรรมล่าสุด{isSuperAdmin ? "" : "ของคุณ"}</h2>
            {isSuperAdmin && <Link className="panel-link" href="/admin/audit"><History size={15} aria-hidden="true" /> ดูทั้งหมด</Link>}
          </div>
          {activities.length === 0 ? (
            <div className="empty-panel">
              <History size={26} aria-hidden="true" />
              <p>ยังไม่มีกิจกรรม</p>
              <span>เมื่อมีการเพิ่ม แก้ไข หรือเผยแพร่เนื้อหา รายการจะแสดงที่นี่</span>
            </div>
          ) : (
            <ul className="activity">
              {activities.map(item => (
                <li key={item.id.toString()}>
                  <span className="avatar" aria-hidden="true">{item.actor?.displayName.charAt(0) ?? "ร"}</span>
                  <div>
                    <p><strong>{item.actor?.displayName ?? "ระบบ"}</strong> {auditLabel(item.action, item.targetType, item.result)}</p>
                    <time dateTime={item.createdAt.toISOString()}>{dateTime.format(item.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="dash-side">
          <section className="panel" aria-labelledby="status-title">
            <div className="panel-header"><h2 id="status-title">สถานะเนื้อหา</h2></div>
            <div className="card-body status-bars">
              {statuses.map(item => (
                <div key={item.label}>
                  <div className="status-bar-label"><span>{item.label}</span><strong>{item.value}</strong></div>
                  <div className="status-bar" aria-hidden="true"><span className={item.tone} style={{ width: `${statusTotal ? (item.value / statusTotal) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel storage-panel" aria-label="พื้นที่เก็บไฟล์">
            <span className="icon-box"><HardDrive size={20} aria-hidden="true" /></span>
            <div>
              <p>พื้นที่เก็บรูปและ PDF</p>
              <strong>{size(mediaBytes)}</strong>
            </div>
          </section>
          <SecurityNote />
        </div>
      </div>
    </>
  );
}
