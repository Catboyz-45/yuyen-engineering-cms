/**
 * หน้าที่ของไฟล์นี้: ตารางประวัติการทำงานของหน้า /admin/audit พร้อมค้นหาและแบ่งหน้า (หน้าเพจตรวจสิทธิ์ Super Admin ฝั่งเซิร์ฟเวอร์)
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: กิจกรรมแสดงเป็นภาษาไทย และยังค้นหาด้วยรหัสกิจกรรมเดิมได้
 */
"use client";
import { useCallback, useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import { AdminPageHeader, SecurityNote } from "@/components/admin-shell";
import { auditLabel } from "@/lib/audit-labels";

type Log = { id: string; action: string; targetType?: string; targetId?: string; result: "SUCCESS" | "FAILURE"; createdAt: string; actor?: { displayName: string; username: string } };
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/** สร้างส่วนหน้าจอ AuditLog; โหลดประวัติจาก API แล้วแสดงเป็นภาษาไทย */
export function AuditLog() {
  const [items, setItems] = useState<Log[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const params = new URLSearchParams({ query, page: String(page), pageSize: "30" });
    const response = await fetch(`/api/admin/audit?${params}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setItems(body.items);
    setPageCount(body.pageCount);
    setTotal(body.total);
  }, [page, query]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      void load()
        .then(() => setError(""))
        .catch(caught => setError(caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <>
      <AdminPageHeader eyebrow="ความปลอดภัย" title="ประวัติการทำงาน" description="ตรวจสอบเหตุการณ์สำคัญและการเปลี่ยนแปลงข้อมูลย้อนหลัง ระบบเก็บไว้อย่างน้อย 180 วัน" action={<SecurityNote />} />
      <div className="admin-filters">
        <label className="search-field">
          <span className="sr-only">ค้นหาประวัติ</span>
          <Search size={18} aria-hidden="true" />
          <input className="field" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="ค้นหาผู้ดำเนินการ รายการ หรือรหัสกิจกรรม" />
        </label>
      </div>
      {error && <div className="auth-alert warning" role="alert">{error}</div>}
      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>กิจกรรม</th><th>ผู้ดำเนินการ</th><th>ผลลัพธ์</th><th>วันและเวลา</th></tr></thead>
            <tbody>
              {loading && !items.length
                ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="skeleton-row" aria-hidden="true"><td><span className="skeleton" style={{ width: "62%" }} /></td><td><span className="skeleton" style={{ width: 110 }} /></td><td><span className="skeleton" style={{ width: 70 }} /></td><td><span className="skeleton" style={{ width: 130 }} /></td></tr>)
                : items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <strong>{auditLabel(item.action, item.targetType, item.result)}</strong>
                      <span className="table-meta">{item.action}{item.targetId ? ` · ${item.targetId}` : ""}</span>
                    </td>
                    <td>{item.actor?.displayName ?? "ระบบ"}</td>
                    <td><span className={`status ${item.result === "FAILURE" ? "failed" : ""}`}>{item.result === "SUCCESS" ? "สำเร็จ" : "ไม่สำเร็จ"}</span></td>
                    <td className="muted">{dateTime.format(new Date(item.createdAt))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!loading && !items.length && (
          <div className="empty-panel">
            <History size={30} aria-hidden="true" />
            <p>{query.trim() ? "ไม่พบกิจกรรมที่ตรงกับคำค้นหา" : "ยังไม่มีประวัติการทำงาน"}</p>
            <span>{query.trim() ? "ลองค้นหาด้วยชื่อผู้ดูแลหรือคำอื่น" : "การเข้าสู่ระบบและการแก้ไขข้อมูลจะถูกบันทึกที่นี่"}</span>
          </div>
        )}
        <div className="pagination">
          <span>ทั้งหมด {total} รายการ</span>
          <div className="cluster">
            <button className="btn btn-ghost" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>ก่อนหน้า</button>
            <span>หน้า {page}/{pageCount}</span>
            <button className="btn btn-ghost" disabled={page >= pageCount || loading} onClick={() => setPage(value => value + 1)}>ถัดไป</button>
          </div>
        </div>
      </section>
    </>
  );
}
