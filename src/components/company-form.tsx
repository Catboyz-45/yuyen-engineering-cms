/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React company-form ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";
import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, Save } from "lucide-react";
import { useUI } from "./ui-feedback";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { LoadingLabel } from "./loading-label";
import { FieldErrors, fieldMessage, focusFirstInvalid, readFieldErrors } from "@/lib/form-validation";
import { MediaUploader } from "./admin/editor-ui";
import { initialSiteCopy, readSiteCopy, SiteCopyFields } from "./admin/site-copy-fields";
type MediaPreview = { id: string; originalName?: string | null; altText?: string | null };
type Company = Record<string, unknown> & { logoMedia?: MediaPreview | null; gallery?: { media: MediaPreview }[] };
const GALLERY_LIMIT = 12;
type FieldKey = "legalName" | "displayName" | "shortDescription" | "history" | "vision" | "mission" | "values" | "address" | "phoneDisplay" | "phoneHref" | "email" | "lineLabel" | "lineUrl" | "facebookUrl" | "mapsUrl" | "mapsEmbedUrl" | "businessHours" | "seoTitle" | "seoDescription";
type Field = { key: FieldKey; label: string; max: number; required?: boolean; multiline?: boolean; half?: boolean; type?: "email" | "url" | "tel"; pattern?: string; help?: string };

const field = (key: FieldKey, label: string, max: number, options: Omit<Field, "key" | "label" | "max"> = {}): Field => ({ key, label, max, ...options });

/** ช่องกรอกจัดเป็นกลุ่มตามตำแหน่งที่แสดงบนหน้าเว็บ ลำดับเดียวกับเมนูด้านข้าง */
const groups = [
  { id: "company-identity", title: "ข้อมูลบริษัท", description: "ชื่อบริษัทและคำแนะนำสั้นๆ ที่ใช้ทั่วทั้งเว็บไซต์", fields: [
    field("legalName", "ชื่อบริษัทตามกฎหมาย", 200, { required: true, help: "ชื่อเต็มตามหนังสือรับรองบริษัท" }),
    field("displayName", "ชื่อที่แสดง", 160, { required: true, help: "ชื่อสั้นที่ต่อท้ายชื่อทุกหน้าและแสดงในส่วนท้ายเว็บ" }),
    field("shortDescription", "คำอธิบายบริษัท", 500, { multiline: true, help: "ย่อหน้าสั้นใต้หัวข้อหน้าเกี่ยวกับเรา" }),
  ] },
  { id: "company-story", title: "เรื่องราวบริษัท", description: "แสดงในหน้าเกี่ยวกับเรา ช่องที่เว้นว่างจะไม่แสดงหัวข้อนั้น", fields: [
    field("history", "ประวัติบริษัท", 20_000, { multiline: true }),
    field("vision", "วิสัยทัศน์", 10_000, { multiline: true }),
    field("mission", "พันธกิจ", 10_000, { multiline: true }),
    field("values", "คุณค่าของเรา", 10_000, { multiline: true, help: "ขึ้นบรรทัดใหม่เพื่อแยกแต่ละข้อ" }),
  ] },
  { id: "company-contact", title: "ช่องทางติดต่อ", description: "แสดงในหน้าติดต่อเราและส่วนท้ายเว็บ ลบข้อมูลออกเพื่อซ่อนช่องทางนั้น", fields: [
    field("address", "ที่อยู่", 2_000, { multiline: true }),
    field("phoneDisplay", "เบอร์โทรที่แสดง", 50, { half: true, help: "รูปแบบที่ผู้เยี่ยมชมเห็น เช่น 02-123-4567" }),
    field("phoneHref", "เบอร์โทรสำหรับลิงก์", 30, { half: true, type: "tel", pattern: "\\+?[0-9]{8,15}", help: "ตัวเลขสำหรับกดโทร เช่น +6621234567" }),
    field("email", "อีเมล", 254, { half: true, type: "email" }),
    field("businessHours", "เวลาทำการ", 200, { half: true, help: "เช่น จันทร์–เสาร์ 08:00–17:00 น." }),
    field("lineLabel", "ชื่อบัญชี LINE", 100, { half: true, help: "เช่น @yuyenengineering" }),
    field("lineUrl", "ลิงก์ LINE", 500, { half: true, type: "url", help: "ลิงก์เพิ่มเพื่อน ขึ้นต้นด้วย https://" }),
    field("facebookUrl", "ลิงก์เพจ Facebook", 500, { type: "url" }),
  ] },
  { id: "company-map", title: "แผนที่", description: "แผนที่จะโหลดเมื่อผู้เยี่ยมชมกดยินยอมเท่านั้น", fields: [
    field("mapsUrl", "ลิงก์ Google Maps", 1_000, { type: "url", help: "ใช้กับปุ่มเปิดเส้นทาง คัดลอกจากปุ่มแชร์ใน Google Maps" }),
    field("mapsEmbedUrl", "ลิงก์ฝังแผนที่", 2_000, { type: "url", help: "ใน Google Maps กด แชร์ → ฝังแผนที่ แล้วคัดลอกเฉพาะลิงก์ในเครื่องหมายคำพูดหลัง src= (ขึ้นต้นด้วย https://www.google.com/maps/embed)" }),
  ] },
  { id: "company-media", title: "โลโก้และรูปบริษัท", description: "ใส่คำอธิบายรูปทุกรูปเพื่อผู้ใช้โปรแกรมอ่านหน้าจอ", fields: [] },
  { id: "company-seo", title: "การแสดงผลในผลการค้นหา", description: "ชื่อและคำอธิบายของหน้าแรกเมื่อแสดงใน Google", fields: [
    field("seoTitle", "ชื่อหน้าในผลการค้นหา (SEO title)", 60, { help: "ไม่เกิน 60 ตัวอักษร" }),
    field("seoDescription", "คำอธิบายในผลการค้นหา (SEO description)", 160, { multiline: true, help: "ไม่เกิน 160 ตัวอักษร ใช้เป็นคำอธิบายเริ่มต้นของหน้าอื่นด้วย" }),
  ] },
] as const;
const fields = groups.flatMap(group => group.fields);
const sectionLinks = [...groups.map(group => ({ id: group.id, title: group.title })), { id: "company-copy", title: "ข้อความบนหน้าเว็บ" }];
const savedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/** สร้างส่วนหน้าจอ CompanyForm; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function CompanyForm() {
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { toast } = useUI();
  const { markDirty, markClean } = useDirtyForm();
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/company")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setCompany(body.company ?? {});
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setError("");
    setFieldErrors({});
    const form = new FormData(formElement);
    const galleryMediaIds = form.getAll("galleryMediaIds").map(String);
    if (galleryMediaIds.length > GALLERY_LIMIT) {
      setSaving(false);
      setError(`รูปบริษัทใส่ได้ไม่เกิน ${GALLERY_LIMIT} รูป`);
      return;
    }
    const siteCopy = readSiteCopy(form);
    if ("error" in siteCopy) {
      setSaving(false);
      setError(siteCopy.error);
      return;
    }
    const payload = {
      ...Object.fromEntries(
        fields.map(({ key }) => [key, String(form.get(key) ?? "").trim() || null]),
      ),
      logoMediaId: String(form.get("logoMediaId") ?? "") || null,
      galleryMediaIds,
      siteCopy: siteCopy.copy,
    };
    // ยังไม่มีเวอร์ชันแปลว่าบันทึกครั้งแรก เซิร์ฟเวอร์จะสร้างข้อมูลบริษัทให้
    const expectedUpdatedAt = typeof company?.updatedAt === "string" ? company.updatedAt : undefined;
    try {
      const response = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(expectedUpdatedAt
            ? { "If-Unmodified-Since": expectedUpdatedAt }
            : {}),
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        const nextErrors = readFieldErrors(body);
        setFieldErrors(nextErrors);
        focusFirstInvalid(formElement, nextErrors);
        throw new Error(body.error);
      }
      markClean();
      setCompany(body.company);
      toast("บันทึกข้อมูลบริษัทเรียบร้อยแล้ว");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  if (!company) return <div className="panel card-body">{error || "กำลังโหลด…"}</div>;
  const lastSaved = typeof company.updatedAt === "string" ? savedAt.format(new Date(company.updatedAt)) : null;
  const renderField = (item: Field) => {
    const message = fieldMessage(fieldErrors, item.key);
    const describedBy = [item.help ? `${item.key}-help` : "", message ? `${item.key}-error` : ""].filter(Boolean).join(" ") || undefined;
    const common = { id: item.key, name: item.key, className: "field", defaultValue: text(company[item.key]), required: item.required, maxLength: item.max, "aria-invalid": Boolean(message), "aria-describedby": describedBy };
    return (
      <div className="form-group" key={item.key}>
        <label className={item.required ? "required" : ""} htmlFor={item.key}>{item.label}</label>
        {item.multiline ? <textarea {...common} rows={item.key === "history" ? 5 : 3} /> : <input {...common} type={item.type === "tel" ? "text" : item.type ?? "text"} inputMode={item.type === "tel" ? "tel" : undefined} pattern={item.pattern} />}
        {item.help && <p className="help" id={`${item.key}-help`}>{item.help}</p>}
        {message && <p className="field-error" id={`${item.key}-error`}>{message}</p>}
      </div>
    );
  };
  return (
    <form className="editor-layout company-editor" onSubmit={submit} onChange={markDirty} onInput={markDirty} aria-busy={saving}>
      <div className="editor-main">
        {error && <div className="auth-alert warning" role="alert">{error}</div>}
        {groups.map(group => (
          <section className="form-section" id={group.id} key={group.id} aria-labelledby={`${group.id}-title`}>
            <div className="form-section-head">
              <h2 id={`${group.id}-title`}>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            {group.id === "company-media" ? (
              <div className="form-stack flush">
                <MediaUploader name="logoMediaId" title="โลโก้บริษัท" multiple={false} initial={preview(company.logoMedia)} onDirty={markDirty} />
                <p className="help">แสดงที่หัวเว็บและท้ายเว็บ ใช้ไฟล์สี่เหลี่ยมจัตุรัสพื้นหลังโปร่งใสหรือพื้นขาว</p>
                <MediaUploader name="galleryMediaIds" title={`รูปบริษัทสำหรับหน้าเกี่ยวกับเรา (สูงสุด ${GALLERY_LIMIT} รูป รูปแรกเป็นภาพหลัก)`} initial={(company.gallery ?? []).flatMap(entry => preview(entry.media))} onDirty={markDirty} />
              </div>
            ) : (
              <div className="form-grid">{group.fields.map(item => <div className={item.half ? "" : "span-2"} key={item.key}>{renderField(item)}</div>)}</div>
            )}
          </section>
        ))}
        <div id="company-copy"><SiteCopyFields initial={initialSiteCopy(company.siteCopy)} /></div>
      </div>
      <aside className="editor-aside">
        <section className="form-section save-card" aria-labelledby="company-save-title">
          <h2 id="company-save-title">บันทึกข้อมูล</h2>
          <p className="help">{lastSaved ? `บันทึกล่าสุด ${lastSaved}` : "ยังไม่เคยบันทึก หน้าเว็บจึงแสดงข้อมูลตัวอย่างอยู่"}</p>
          <button className="btn btn-dark" disabled={saving} aria-busy={saving}>
            <LoadingLabel busy={saving} busyText="กำลังบันทึก…"><><Save size={17} /> บันทึกการเปลี่ยนแปลง</></LoadingLabel>
          </button>
          <p className="help">มีผลกับหน้าเว็บทันทีหลังบันทึก ช่องที่เว้นว่างจะไม่แสดงบนหน้าเว็บ</p>
          <a className="btn btn-outline" href="/about" target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" /> ดูหน้าเกี่ยวกับเรา</a>
        </section>
        <nav className="form-section section-nav" aria-label="ไปยังส่วนของฟอร์ม">
          <h2>ในหน้านี้</h2>
          <ul>{sectionLinks.map(link => <li key={link.id}><a href={`#${link.id}`}>{link.title}</a></li>)}</ul>
        </nav>
      </aside>
    </form>
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function preview(media: MediaPreview | null | undefined) {
  return media ? [{ id: media.id, name: media.originalName ?? "ไฟล์เดิม", preview: `/api/media/${media.id}?width=640`, altText: media.altText ?? "" }] : [];
}
