/**
 * หน้าที่ของไฟล์นี้: ช่องกรอกข้อความบนหน้าเว็บ (หน้าแรก เกี่ยวกับเรา คำนำหน้ารายการ และท้ายเว็บ) ในหน้าข้อมูลบริษัท
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ช่องที่มีเครื่องหมายบังคับต้องกรอก ช่องอื่นเว้นว่างเพื่อซ่อนจากหน้าเว็บได้
 */
"use client";
import { COPY_ITEM_LIMITS, DEFAULT_SITE_COPY, HIGHLIGHT_LIMIT, PROCESS_STEP_LIMIT, siteCopyTextFields, type CopyItem, type SiteCopy } from "@/lib/site-copy";
import { FormSection } from "./editor-ui";

const groups = [...new Set(siteCopyTextFields.map(field => field.group))];
const lists = [
  { key: "highlights", label: "จุดเด่นใต้ภาพหน้าแรก", item: "จุดเด่น", limit: HIGHLIGHT_LIMIT },
  { key: "processSteps", label: "ขั้นตอนการทำงานในหน้าแรก", item: "ขั้นตอน", limit: PROCESS_STEP_LIMIT },
] as const;

/** ค่าที่ใช้เติมฟอร์ม: ข้อความที่บันทึกไว้ หรือค่าเริ่มต้นถ้ายังไม่เคยบันทึก (เซิร์ฟเวอร์ตรวจซ้ำตอนบันทึก) */
export function initialSiteCopy(stored: unknown): SiteCopy {
  return stored && typeof stored === "object" && !Array.isArray(stored) ? { ...DEFAULT_SITE_COPY, ...(stored as Partial<SiteCopy>) } : DEFAULT_SITE_COPY;
}

/** อ่านข้อความจากฟอร์ม; แถวรายการที่ว่างทั้งแถวจะถูกตัดออก แถวที่มีคำอธิบายแต่ไม่มีหัวข้อถือว่าไม่ถูกต้อง */
export function readSiteCopy(form: FormData): { copy: SiteCopy } | { error: string } {
  const value = (name: string) => String(form.get(name) ?? "").trim();
  const texts = Object.fromEntries(siteCopyTextFields.map(field => [field.key, value(`copy.${field.key}`)]));
  const result = { ...texts } as Record<string, unknown>;
  for (const list of lists) {
    const items: CopyItem[] = [];
    for (let index = 0; index < list.limit; index += 1) {
      const title = value(`copy.${list.key}.${index}.title`);
      const text = value(`copy.${list.key}.${index}.text`);
      if (!title && text) return { error: `${list.item}ที่ ${index + 1} ต้องมีหัวข้อ` };
      if (title) items.push({ title, text });
    }
    result[list.key] = items;
  }
  return { copy: result as SiteCopy };
}

/** สร้างส่วนหน้าจอ SiteCopyFields สำหรับแก้ข้อความบนหน้าเว็บ */
export function SiteCopyFields({ initial }: { initial: SiteCopy }) {
  return (
    <FormSection title="ข้อความบนหน้าเว็บ" description="เว้นว่างเพื่อซ่อนข้อความนั้น กด Enter ในหัวข้อเพื่อขึ้นบรรทัดใหม่">
      {groups.map(group => (
        <fieldset className="form-stack" key={group} style={{ border: 0, padding: 0, margin: "0 0 24px" }}>
          <legend className="subheading" style={{ marginBottom: 12 }}>{group}</legend>
          {siteCopyTextFields.filter(field => field.group === group).map(field => (
            <div className="form-group" key={field.key}>
              <label className={field.required ? "required" : ""} htmlFor={`copy-${field.key}`}>{field.label}</label>
              <textarea id={`copy-${field.key}`} name={`copy.${field.key}`} className="field" rows={2} maxLength={field.max} required={field.required} defaultValue={initial[field.key]} />
            </div>
          ))}
          {group === "หน้าแรก" && lists.map(list => (
            <div className="form-stack" key={list.key}>
              <p className="subheading">{list.label} (สูงสุด {list.limit} รายการ)</p>
              {Array.from({ length: list.limit }, (_, index) => (
                <div className="grid-2" key={index}>
                  <div className="form-group">
                    <label htmlFor={`copy-${list.key}-${index}-title`}>{list.item}ที่ {index + 1} — หัวข้อ</label>
                    <input id={`copy-${list.key}-${index}-title`} name={`copy.${list.key}.${index}.title`} className="field" maxLength={COPY_ITEM_LIMITS.title} defaultValue={initial[list.key][index]?.title ?? ""} />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`copy-${list.key}-${index}-text`}>{list.item}ที่ {index + 1} — คำอธิบาย</label>
                    <input id={`copy-${list.key}-${index}-text`} name={`copy.${list.key}.${index}.text`} className="field" maxLength={COPY_ITEM_LIMITS.text} defaultValue={initial[list.key][index]?.text ?? ""} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </fieldset>
      ))}
    </FormSection>
  );
}
