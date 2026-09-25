/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React company-form ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";
import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useUI } from "./ui-feedback";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { LoadingLabel } from "./loading-label";
import { FieldErrors, fieldMessage, focusFirstInvalid, readFieldErrors } from "@/lib/form-validation";
import { MediaUploader } from "./admin/editor-ui";
import { initialSiteCopy, readSiteCopy, SiteCopyFields } from "./admin/site-copy-fields";
type MediaPreview = { id: string; originalName?: string | null; altText?: string | null };
type Company = Record<string, unknown> & { logoMedia?: MediaPreview | null; gallery?: { media: MediaPreview }[] };
const GALLERY_LIMIT = 12;
const limits: Record<string, number> = { legalName: 200, displayName: 160, shortDescription: 500, history: 20000, vision: 10000, mission: 10000, values: 10000, address: 2000, phoneDisplay: 50, phoneHref: 30, email: 254, lineLabel: 100, lineUrl: 500, facebookUrl: 500, mapsUrl: 1000, mapsEmbedUrl: 2000, businessHours: 200, seoTitle: 60, seoDescription: 160 };
const urlFields = new Set(["lineUrl", "facebookUrl", "mapsUrl", "mapsEmbedUrl"]);
const fields = [
  ["legalName", "ชื่อบริษัทตามกฎหมาย", true],
  ["displayName", "ชื่อที่แสดง", true],
  ["shortDescription", "คำอธิบายบริษัท", false],
  ["history", "ประวัติบริษัท", false],
  ["vision", "วิสัยทัศน์", false],
  ["mission", "พันธกิจ", false],
  ["values", "คุณค่าของเรา", false],
  ["address", "ที่อยู่", false],
  ["phoneDisplay", "เบอร์โทรที่แสดง", false],
  ["phoneHref", "เบอร์โทรสำหรับลิงก์", false],
  ["email", "อีเมล", false],
  ["lineLabel", "LINE Official", false],
  ["lineUrl", "LINE URL", false],
  ["facebookUrl", "Facebook URL", false],
  ["mapsUrl", "Google Maps URL", false],
  ["mapsEmbedUrl", "Maps Embed URL", false],
  ["businessHours", "เวลาทำการ", false],
  ["seoTitle", "SEO title", false],
  ["seoDescription", "SEO description", false],
] as const;
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
        fields.map(([key]) => [key, String(form.get(key) ?? "").trim() || null]),
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
  if (!company) return <div className="card-body">{error || "กำลังโหลด…"}</div>;
  return (
    <form
      className="card-body form-stack"
      style={{ maxWidth: 840, margin: 0 }}
      onSubmit={submit}
      onChange={markDirty}
      onInput={markDirty}
      aria-busy={saving}
    >
      {error && <div className="auth-alert warning">{error}</div>}
      {fields.map(([key, label, required]) => (
        <div className="form-group" key={key}>
          {(() => {
            const message = fieldMessage(fieldErrors, key);
            const errorId = `${key}-error`;
            return <>
          <label className={required ? "required" : ""} htmlFor={key}>
            {label}
          </label>
          {[
            "shortDescription",
            "history",
            "vision",
            "mission",
            "values",
            "address",
            "seoDescription",
          ].includes(key) ? (
            <textarea
              id={key}
              name={key}
              className="field"
              rows={3}
              defaultValue={text(company[key])}
              required={required}
              maxLength={limits[key]}
              aria-invalid={Boolean(message)}
              aria-describedby={message ? errorId : undefined}
            />
          ) : (
            <input
              id={key}
              name={key}
              className="field"
              defaultValue={text(company[key])}
              required={required}
              type={key === "email" ? "email" : urlFields.has(key) ? "url" : "text"}
              maxLength={limits[key]}
              pattern={key === "phoneHref" ? "\\+?[0-9]{8,15}" : undefined}
              aria-invalid={Boolean(message)}
              aria-describedby={message ? errorId : undefined}
            />
          )}
          {message && <p className="field-error" id={errorId}>{message}</p>}
            </>;
          })()}
        </div>
      ))}
      <MediaUploader
        name="logoMediaId"
        title="โลโก้บริษัท"
        multiple={false}
        initial={preview(company.logoMedia)}
        onDirty={markDirty}
      />
      <MediaUploader
        name="galleryMediaIds"
        title={`รูปบริษัทสำหรับหน้าเกี่ยวกับเรา (สูงสุด ${GALLERY_LIMIT} รูป รูปแรกเป็นภาพหลัก)`}
        initial={(company.gallery ?? []).flatMap((entry) => preview(entry.media))}
        onDirty={markDirty}
      />
      <SiteCopyFields initial={initialSiteCopy(company.siteCopy)} />
      <p className="help">ช่องที่เว้นว่างจะไม่แสดงบนหน้าเว็บ</p>
      <button className="btn btn-dark" disabled={saving} aria-busy={saving}>
        <LoadingLabel busy={saving} busyText="กำลังบันทึก…">
          <>
            <Save size={17} /> บันทึกการเปลี่ยนแปลง
          </>
        </LoadingLabel>
      </button>
    </form>
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function preview(media: MediaPreview | null | undefined) {
  return media ? [{ id: media.id, name: media.originalName ?? "ไฟล์เดิม", preview: `/api/media/${media.id}?width=640`, altText: media.altText ?? "" }] : [];
}
