/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React admin-table ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  FolderSearch,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { AdminPageHeader } from "./admin-shell";
import { useUI } from "./ui-feedback";
import { LoadingLabel } from "./loading-label";
import { ThemeSelect } from "./theme-select";

type Kind = "banners" | "services" | "products" | "projects" | "news";
type Row = {
  id: string;
  slug?: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  publishedAt?: string | null;
};
type Result = { items: Row[]; total: number; page: number; pageCount: number };
const statusText = {
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "เผยแพร่แล้ว",
  ARCHIVED: "เก็บถาวร",
};
const displayStatus = (row: Row) => row.status === "PUBLISHED" && row.publishedAt && new Date(row.publishedAt).getTime() > Date.now() ? "กำหนดเผยแพร่" : statusText[row.status];
type RowAction = "publish" | "unpublish" | "archive" | "trash";
type RowStatus = Row["status"];

const statusClass: Record<RowStatus, string> = { DRAFT: "draft", PUBLISHED: "", ARCHIVED: "archived" };
const actionLabels: Record<RowAction, string> = {
  publish: "เผยแพร่",
  unpublish: "ยกเลิกเผยแพร่",
  archive: "เก็บถาวร",
  trash: "ย้ายไปถังขยะ",
};
/** ปุ่มสลับสถานะของแต่ละแถว: เผยแพร่แล้ว → ยกเลิก, เก็บถาวร → กลับเป็นฉบับร่าง, ฉบับร่าง → เผยแพร่ */
const toggleFor: Record<RowStatus, { action: RowAction; title: string; icon: typeof Eye }> = {
  PUBLISHED: { action: "unpublish", title: "ยกเลิกเผยแพร่", icon: EyeOff },
  ARCHIVED: { action: "unpublish", title: "นำกลับเป็นฉบับร่าง", icon: ArchiveRestore },
  DRAFT: { action: "publish", title: "เผยแพร่", icon: Eye },
};
const updatedFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

function restoresDraft(row: Row, action: RowAction) {
  return row.status === "ARCHIVED" && action === "unpublish";
}
function actionLabel(row: Row, action: RowAction) {
  return restoresDraft(row, action) ? "นำกลับเป็นฉบับร่าง" : actionLabels[action];
}
function actionDescription(row: Row, action: RowAction) {
  if (action === "trash") return "รายการจะถูกซ่อนและกู้คืนได้ภายใน 30 วัน";
  if (restoresDraft(row, action)) return "รายการจะกลับมาเป็นฉบับร่างและยังไม่แสดงบนเว็บไซต์ จากนั้นจึงแก้ไขหรือเผยแพร่ใหม่ได้";
  return "ระบบจะบันทึกการเปลี่ยนแปลงนี้ใน Audit Log";
}

/** สร้างส่วนหน้าจอ AdminTablePage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AdminTablePage({
  title,
  description,
  basePath,
  kind,
}: Readonly<{
  title: string;
  description: string;
  basePath: string;
  kind: Kind;
}>) {
  const router = useRouter();
  const { confirm, toast } = useUI();
  const [result, setResult] = useState<Result>({
    items: [],
    total: 0,
    page: 1,
    pageCount: 1,
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("updated-desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingRow, setPendingRow] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        query,
        status,
        sort,
        page: String(page),
        pageSize: "10",
      });
      const response = await fetch(`/api/admin/content/${kind}?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [kind, page, query, sort, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function transition(row: Row, action: RowAction) {
    const label = actionLabel(row, action);
    const accepted = await confirm({
      title: `${label} “${row.title}”?`,
      description: actionDescription(row, action),
      confirmLabel: label,
      tone: action === "trash" ? "danger" : undefined,
    });
    if (!accepted || pendingRow) return;
    setPendingRow(row.id);
    try {
      const response = await fetch(
        `/api/admin/content/${kind}/${row.id}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(body.error ?? "ดำเนินการไม่สำเร็จ", "error");
        return;
      }
      toast(`${label}แล้ว`);
      await load();
    } catch {
      toast("การเชื่อมต่อขัดข้อง กรุณาลองอีกครั้ง", "error");
    } finally {
      setPendingRow(null);
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="เนื้อหาเว็บไซต์"
        title={title}
        description={description}
        action={
          <button type="button"
            className="btn btn-dark"
            onClick={() => router.push(`${basePath}/new`)}
          >
            <Plus size={17} aria-hidden="true" /> เพิ่ม{title}
          </button>
        }
      />
      <div className="admin-filters">
        <label className="search-field">
          <span className="sr-only">ค้นหา</span>
          <Search size={18} />
          <input
            className="field"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={`ค้นหา${title}`}
          />
        </label>
        <ThemeSelect
          label="กรองตามสถานะ"
          value={status}
          onValueChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          options={[
            { value: "ALL", label: "ทุกสถานะ" },
            { value: "PUBLISHED", label: "เผยแพร่แล้ว" },
            { value: "DRAFT", label: "ฉบับร่าง" },
            { value: "ARCHIVED", label: "เก็บถาวร" },
          ]}
        />
        <ThemeSelect
          label="เรียงลำดับ"
          value={sort}
          onValueChange={setSort}
          options={[
            { value: "updated-desc", label: "แก้ไขล่าสุด" },
            { value: "updated-asc", label: "แก้ไขเก่าสุด" },
            { value: "title-asc", label: "ชื่อ ก–ฮ" },
            { value: "title-desc", label: "ชื่อ ฮ–ก" },
          ]}
        />
      </div>
      {error && (
        <div className="auth-alert warning" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="table-wrap">
          <table className="data-table" aria-busy={loading}>
            <thead>
              <tr>
                <th>ชื่อรายการ</th>
                <th>สถานะ</th>
                <th>แก้ไขล่าสุด</th>
                <th><span className="sr-only">การทำงาน</span></th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                ["58%", "46%", "64%", "52%"].map((width) => (
                  <tr key={width} className="skeleton-row">
                    <td><span className="skeleton" style={{ width }} /></td>
                    <td><span className="skeleton" style={{ width: 84 }} /></td>
                    <td><span className="skeleton" style={{ width: 120 }} /></td>
                    <td />
                  </tr>
                ))}
              {!loading &&
                result.items.map((row) => (
                  <ContentRow
                    key={row.id}
                    row={row}
                    pendingRow={pendingRow}
                    onTransition={transition}
                    onEdit={() => router.push(`${basePath}/${row.slug ?? row.id}/edit`)}
                  />
                ))}
            </tbody>
          </table>
        </div>
        {!loading && !result.items.length && (
          <EmptyContent
            title={title}
            filtered={Boolean(query.trim()) || status !== "ALL"}
            onCreate={() => router.push(`${basePath}/new`)}
          />
        )}
        <div className="pagination">
          <span>ทั้งหมด {result.total} รายการ</span>
          <div className="cluster">
            <button type="button"
              className="btn btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              ก่อนหน้า
            </button>
            <span>
              หน้า {result.page}/{result.pageCount}
            </span>
            <button type="button"
              className="btn btn-ghost"
              disabled={page >= result.pageCount || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function ContentRow({
  row,
  pendingRow,
  onTransition,
  onEdit,
}: Readonly<{
  row: Row;
  pendingRow: string | null;
  onTransition: (row: Row, action: RowAction) => void;
  onEdit: () => void;
}>) {
  const toggle = toggleFor[row.status];
  const ToggleIcon = toggle.icon;
  const busy = pendingRow === row.id;
  const locked = pendingRow !== null;
  return (
    <tr>
      <td>
        <strong>{row.title}</strong>
      </td>
      <td>
        <span className={`status ${statusClass[row.status]}`}>{displayStatus(row)}</span>
      </td>
      <td className="muted">{updatedFormat.format(new Date(row.updatedAt))}</td>
      <td>
        <div className="row-actions">
          <button
            type="button"
            className="icon-btn"
            disabled={locked}
            aria-busy={busy}
            aria-label={`${toggle.title} ${row.title}`}
            title={toggle.title}
            onClick={() => onTransition(row, toggle.action)}
          >
            {busy ? (
              <LoadingLabel busy busyText="">
                <span className="sr-only">กำลังดำเนินการ</span>
              </LoadingLabel>
            ) : (
              <ToggleIcon size={16} />
            )}
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={locked}
            aria-label={`แก้ไข ${row.title}`}
            title="แก้ไข"
            onClick={onEdit}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`เก็บ ${row.title} ถาวร`}
            title="เก็บเข้าคลัง (ซ่อนจากหน้าเว็บ)"
            disabled={row.status === "ARCHIVED" || locked}
            aria-busy={busy}
            onClick={() => onTransition(row, "archive")}
          >
            <Archive size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={locked}
            aria-busy={busy}
            aria-label={`ย้าย ${row.title} ไปถังขยะ`}
            title="ย้ายไปถังขยะ"
            onClick={() => onTransition(row, "trash")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmptyContent({ title, filtered, onCreate }: Readonly<{ title: string; filtered: boolean; onCreate: () => void }>) {
  if (filtered) {
    return (
      <div className="empty-panel">
        <FolderSearch size={30} aria-hidden="true" />
        <p>ไม่พบรายการที่ตรงกับตัวกรอง</p>
        <span>ลองเปลี่ยนคำค้นหาหรือสถานะที่เลือก</span>
      </div>
    );
  }
  return (
    <div className="empty-panel">
      <FolderSearch size={30} aria-hidden="true" />
      <p>ยังไม่มี{title}</p>
      <span>เพิ่มรายการแรก บันทึกเป็นฉบับร่างก่อนได้ แล้วค่อยเผยแพร่เมื่อพร้อม</span>
      <button type="button" className="btn btn-dark" style={{ marginTop: 10 }} onClick={onCreate}>
        <Plus size={17} aria-hidden="true" /> เพิ่ม{title}
      </button>
    </div>
  );
}
