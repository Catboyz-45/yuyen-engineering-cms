/**
 * หน้าที่ของไฟล์นี้: ฟอร์มหลังบ้านสำหรับข้อมูลที่บริษัทต้องยืนยันในหน้านโยบาย และการรับรองประกาศใช้
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: การรับรองจะถอดป้ายฉบับร่าง เปิดให้เครื่องมือค้นหาเก็บหน้า และเพิ่มหน้าใน sitemap
 */
"use client";
import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, Save } from "lucide-react";
import { useUI } from "./ui-feedback";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { LoadingLabel } from "./loading-label";
import { FieldErrors, fieldMessage, focusFirstInvalid, readFieldErrors } from "@/lib/form-validation";
import { legalLinks } from "@/lib/legal";

type Notice = { privacyEmail: string | null; serviceProviders: string | null; retention: string | null; approvedAt: string | null; approvedRevision: string | null; updatedAt: string; approvedBy: { displayName: string } | null };
type State = { notice: Notice | null; revision: string; approved: boolean };

const fields = [
  { key: "privacyEmail", label: "อีเมลรับคำร้องเรื่องข้อมูลส่วนบุคคล", max: 254, help: "อีเมลที่มีผู้รับผิดชอบตอบคำร้องจริง แสดงในหัวข้อสิทธิของเจ้าของข้อมูล" },
  { key: "serviceProviders", label: "ผู้ให้บริการและพื้นที่จัดเก็บข้อมูล", max: 2000, help: "เช่น ผู้ให้บริการโฮสติ้ง ฐานข้อมูล ที่เก็บรูป/PDF และสำเนาสำรอง พร้อมประเทศหรือภูมิภาคที่เก็บข้อมูล หนึ่งรายการต่อบรรทัด" },
  { key: "retention", label: "ระยะเวลาเก็บข้อมูลที่บริษัทกำหนด", max: 2000, help: "ระยะเวลาเก็บสูงสุดของประวัติระบบ (อย่างน้อย 180 วัน) บันทึกโฮสติ้ง ข้อมูลติดต่อ และสำเนาสำรอง" },
] as const;

const thaiDateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" });

/** สร้างส่วนหน้าจอ LegalNoticeForm; โหลดข้อมูลเดิม แล้วบันทึกพร้อมกันการเขียนทับจากผู้ดูแลคนอื่น */
export function LegalNoticeForm() {
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { toast } = useUI();
  const { markDirty, markClean } = useDirtyForm();
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/legal")
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setState(body);
      })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ"); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setFieldErrors({});
    const payload = { ...Object.fromEntries(fields.map(({ key }) => [key, String(form.get(key) ?? "").trim() || null])), approved: form.get("approved") === "on" };
    const expectedUpdatedAt = state?.notice?.updatedAt;
    try {
      const response = await fetch("/api/admin/legal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(expectedUpdatedAt ? { "If-Unmodified-Since": expectedUpdatedAt } : {}) },
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
      setState(body);
      toast(body.approved ? "บันทึกและประกาศใช้นโยบายเรียบร้อยแล้ว" : "บันทึกข้อมูลนโยบายเรียบร้อยแล้ว (ฉบับร่าง)");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!state) return <div className="panel card-body">{error || "กำลังโหลด…"}</div>;
  const { notice, revision, approved } = state;
  const staleApproval = !approved && notice?.approvedAt && notice.approvedRevision !== revision;
  return (
    <form key={notice?.updatedAt ?? "new"} className="editor-layout" onSubmit={submit} onChange={markDirty} onInput={markDirty} aria-busy={saving}>
      <div className="editor-main">
        {error && <div className="auth-alert warning" role="alert">{error}</div>}
        <section className="form-section" aria-labelledby="legal-fields-title">
          <div className="form-section-head">
            <h2 id="legal-fields-title">ข้อมูลที่บริษัทต้องยืนยัน</h2>
            <p>แสดงในหน้านโยบายทันทีหลังบันทึก แม้ยังเป็นฉบับร่าง เพื่อให้ตรวจบนหน้าจริงได้</p>
          </div>
          <div className="form-stack flush">
            {fields.map(field => {
              const message = fieldMessage(fieldErrors, field.key);
              const errorId = `${field.key}-error`;
              const helpId = `${field.key}-help`;
              const value = notice?.[field.key] ?? "";
              return (
                <div className="form-group" key={field.key}>
                  <label htmlFor={field.key}>{field.label}</label>
                  {field.key === "privacyEmail"
                    ? <input id={field.key} name={field.key} className="field" type="email" maxLength={field.max} defaultValue={value} aria-invalid={Boolean(message)} aria-describedby={[helpId, message ? errorId : ""].filter(Boolean).join(" ")} />
                    : <textarea id={field.key} name={field.key} className="field" rows={4} maxLength={field.max} defaultValue={value} aria-invalid={Boolean(message)} aria-describedby={[helpId, message ? errorId : ""].filter(Boolean).join(" ")} />}
                  <p className="help" id={helpId}>{field.help}</p>
                  {message && <p className="field-error" id={errorId}>{message}</p>}
                </div>
              );
            })}
          </div>
        </section>
        <p className="info-note">ข้อความส่วนอื่นของนโยบายอธิบายการทำงานของระบบ เช่น คุกกี้ล็อกอินและแผนที่ จึงแก้ผ่านนักพัฒนาเท่านั้น</p>
      </div>
      <aside className="editor-aside">
        <section className="form-section save-card" aria-labelledby="legal-save-title">
          <h2 id="legal-save-title">สถานะการประกาศใช้</h2>
          <div className={`auth-alert ${approved ? "success" : "warning"}`} role="status">
            {approved && notice?.approvedAt
              ? <>ประกาศใช้แล้ว (ข้อความฉบับ {revision}) เมื่อ {thaiDateTime.format(new Date(notice.approvedAt))}{notice.approvedBy ? ` โดย ${notice.approvedBy.displayName}` : ""}</>
              : staleApproval
                ? <>ข้อความนโยบายถูกปรับเป็นฉบับ {revision} หลังการรับรองครั้งก่อน (ฉบับ {notice.approvedRevision}) หน้าเว็บจึงกลับเป็นฉบับร่าง กรุณาตรวจและรับรองใหม่</>
                : <>ฉบับร่าง — หน้านโยบายแสดงป้ายฉบับร่างและยังไม่ให้เครื่องมือค้นหาเก็บหน้า</>}
          </div>
          <label className="approve-check">
            <input type="checkbox" name="approved" defaultChecked={approved} />
            <span>
              <strong>รับรองและประกาศใช้นโยบายฉบับ {revision}</strong>
              <span className="help">ติ๊กเมื่อผู้รับผิดชอบข้อมูลหรือที่ปรึกษากฎหมายตรวจครบทั้ง 3 หน้าแล้ว ต้องกรอกทั้ง 3 ช่อง เอาติ๊กออกเพื่อกลับเป็นฉบับร่าง</span>
            </span>
          </label>
          <button className="btn btn-dark" disabled={saving} aria-busy={saving}>
            <LoadingLabel busy={saving} busyText="กำลังบันทึก…"><><Save size={17} /> บันทึก</></LoadingLabel>
          </button>
        </section>
        <nav className="form-section section-nav" aria-label="ตรวจหน้านโยบายจริง">
          <h2>ตรวจหน้าจริง</h2>
          <ul>{legalLinks.map(link => <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer">{link.label} <ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> (เปิดแท็บใหม่)</span></a></li>)}</ul>
        </nav>
      </aside>
    </form>
  );
}
