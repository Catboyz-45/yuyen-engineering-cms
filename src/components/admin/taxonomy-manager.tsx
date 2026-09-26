/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React taxonomy-manager ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";
import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ImagePlus, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminPageHeader } from "../admin-shell";
import { useUI } from "../ui-feedback";
import { MediaUploader } from "./editor-ui";
import { formText } from "@/lib/form-data";
type Kind = "brands" | "product-types" | "news-categories";
type Item = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  _count: { products?: number; news?: number };
  logoMedia?: { id: string; originalName: string | null } | null;
};
const tabs = [
  ["/admin/taxonomies/news-categories", "หมวดหมู่ข่าว"],
  ["/admin/taxonomies/brands", "ยี่ห้อสินค้า"],
  ["/admin/taxonomies/product-types", "ประเภทสินค้า"],
] as const;
/** ส่งคำขอ JSON ไปยัง API หลังบ้าน แล้วโยนข้อความข้อผิดพลาดจากเซิร์ฟเวอร์เมื่อไม่สำเร็จ */
async function request(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error);
}

/** สร้างส่วนหน้าจอ TaxonomyManager; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function TaxonomyManager({
  title,
  description,
  singular,
  kind,
}: Readonly<{
  title: string;
  description: string;
  singular: string;
  kind: Kind;
}>) {
  const pathname = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [logoFor, setLogoFor] = useState<string | null>(null);
  const brands = kind === "brands";
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const { confirm, toast } = useUI();
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/taxonomies/${kind}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setItems(body.items);
  }, [kind]);
  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/taxonomies/${kind}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setItems(body.items);
      })
      .catch((caughtError) => {
        if (active)
          setError(
            caughtError instanceof Error ? caughtError.message : "โหลดข้อมูลไม่สำเร็จ",
          );
      });
    return () => {
      active = false;
    };
  }, [kind]);
  async function add(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending("add");
    setError("");
    try {
      await request(`/api/admin/taxonomies/${kind}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          sortOrder: items.length,
          isActive: true,
        }),
      });
      setName("");
      setSlug("");
      toast(`เพิ่ม${singular}แล้ว`);
      await load();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }
  async function save(item: Item) {
    if (pending) return;
    setPending(item.id);
    try {
      await request(`/api/admin/taxonomies/${kind}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          slug: item.slug,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
        }),
      });
      setEditing(null);
      await load();
      toast("บันทึกแล้ว");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }
  /** บันทึกโลโก้ยี่ห้อ (ไม่เลือกไฟล์ = เอาโลโก้ออก แถบแบรนด์จะแสดงชื่อแทน) */
  async function saveLogo(event: FormEvent<HTMLFormElement>, item: Item) {
    event.preventDefault();
    if (pending) return;
    setPending(item.id);
    try {
      await request(`/api/admin/taxonomies/${kind}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: item.name,
          slug: item.slug,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          logoMediaId: formText(new FormData(event.currentTarget), "logoMediaId") || null,
        }),
      });
      setLogoFor(null);
      await load();
      toast("บันทึกโลโก้แล้ว");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }
  async function remove(item: Item) {
    if (pending) return;
    if (
      !(await confirm({
        title: `ย้าย “${item.name}” ไปถังขยะ?`,
        description: "ทำได้เฉพาะรายการที่ไม่มีเนื้อหาอ้างอิง",
        confirmLabel: "ย้ายไปถังขยะ",
        tone: "danger",
      }))
    )
      return;
    setPending(item.id);
    try {
      const response = await fetch(`/api/admin/taxonomies/${kind}/${item.id}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      await load();
      toast("ย้ายไปถังขยะแล้ว");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "ลบไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }
  return (
    <>
      <AdminPageHeader eyebrow="หมวดหมู่" title={title} description={description} />
      <nav className="segmented-tabs" aria-label="ประเภทหมวดหมู่">
        {tabs.map(([href, label]) => (
          <Link key={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      {error && (
        <div className="auth-alert warning" role="alert">
          {error}
        </div>
      )}
      <div className="taxonomy-grid">
        <form
          className="form-section"
          onSubmit={add}
          aria-busy={pending === "add"}
        >
          <div className="form-section-head">
            <h2>เพิ่ม{singular}</h2>
            <p>ชื่อและลิงก์ต้องไม่ซ้ำกับรายการเดิม</p>
          </div>
          <div className="form-stack">
            <label>
              <span>ชื่อ</span>
              <input
                className="field"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label>
              <span>ลิงก์ (slug) — ภาษาอังกฤษตัวพิมพ์เล็ก ตัวเลข และขีดกลาง</span>
              <input
                className="field"
                value={slug}
                onChange={(event) =>
                  setSlug(
                    event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
            </label>
            <button type="submit"
              className="btn btn-dark"
              disabled={pending !== null}
              aria-busy={pending === "add"}
            >
              {pending === "add" ? (
                <>
                  <LoaderCircle className="spin" size={17} /> กำลังเพิ่ม…
                </>
              ) : (
                <>
                  <Plus size={17} /> เพิ่ม{singular}
                </>
              )}
            </button>
          </div>
        </form>
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  {brands && <th>โลโก้</th>}
                  <th>ลิงก์ (slug)</th>
                  <th>ใช้งาน</th>
                  <th aria-label="การทำงาน" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const count = item._count.products ?? item._count.news ?? 0;
                  return (
                    <Fragment key={item.id}>
                    <tr>
                      <td>
                        {editing === item.id ? (
                          <input
                            className="field"
                            value={editName}
                            onChange={(event) =>
                              setEditName(event.target.value)
                            }
                            aria-label={`แก้ไขชื่อ ${item.name}`}
                          />
                        ) : (
                          <strong>{item.name}</strong>
                        )}
                      </td>
                      {brands && (
                        <td>
                          <div className="brand-logo-cell">
                            {item.logoMedia ? (
                              // eslint-disable-next-line @next/next/no-img-element -- รูปย่อจาก API สื่อหลังบ้าน ขนาดคงที่
                              <img src={`/api/media/${item.logoMedia.id}?width=160`} alt="" width={64} height={32} />
                            ) : (
                              <span className="muted">ใช้ชื่อแทน</span>
                            )}
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={pending !== null}
                              aria-expanded={logoFor === item.id}
                              aria-label={`${item.logoMedia ? "เปลี่ยน" : "เพิ่ม"}โลโก้ ${item.name}`}
                              onClick={() => setLogoFor(logoFor === item.id ? null : item.id)}
                            >
                              <ImagePlus size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                      <td>{item.slug}</td>
                      <td>{count} รายการ</td>
                      <td>
                        <div className="row-actions">
                          {editing === item.id ? (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={pending !== null}
                                aria-busy={pending === item.id}
                                aria-label={`บันทึกการแก้ไข ${item.name}`}
                                onClick={() => save(item)}
                              >
                                {pending === item.id ? (
                                  <LoaderCircle className="spin" size={16} />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={pending !== null}
                                aria-label={`ยกเลิกการแก้ไข ${item.name}`}
                                onClick={() => setEditing(null)}
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={pending !== null}
                                aria-label={`แก้ไข ${item.name}`}
                                onClick={() => {
                                  setEditing(item.id);
                                  setEditName(item.name);
                                }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={
                                  count > 0
                                    ? `ไม่สามารถลบ ${item.name} เนื่องจากมีข้อมูลอ้างอิง ${count} รายการ`
                                    : `ย้าย ${item.name} ไปถังขยะ`
                                }
                                disabled={count > 0 || pending !== null}
                                aria-busy={pending === item.id}
                                onClick={() => remove(item)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {logoFor === item.id && (
                      <tr className="brand-logo-row">
                        <td colSpan={5}>
                          <form onSubmit={(event) => saveLogo(event, item)} aria-busy={pending === item.id}>
                            <MediaUploader
                              name="logoMediaId"
                              title={`โลโก้ ${item.name}`}
                              multiple={false}
                              describe={false}
                              initial={item.logoMedia ? [{ id: item.logoMedia.id, name: item.logoMedia.originalName ?? "ไฟล์เดิม", preview: `/api/media/${item.logoMedia.id}?width=640` }] : []}
                            />
                            <p className="help">แสดงในแถบแบรนด์หน้าแรกคู่กับชื่อยี่ห้อ ใช้ไฟล์พื้นหลังโปร่งใสหรือพื้นขาว ลบรูปออกแล้วบันทึกเพื่อกลับไปแสดงชื่อแทน</p>
                            <div className="cluster">
                              <button type="submit" className="btn btn-dark" disabled={pending !== null}>
                                {pending === item.id ? <><LoaderCircle className="spin" size={17} /> กำลังบันทึก…</> : <><Check size={17} /> บันทึกโลโก้</>}
                              </button>
                              <button type="button" className="btn btn-ghost" disabled={pending !== null} onClick={() => setLogoFor(null)}>ยกเลิก</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
