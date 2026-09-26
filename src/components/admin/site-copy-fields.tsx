/**
 * หน้าที่ของไฟล์นี้: ช่องกรอกข้อความบนหน้าเว็บ (หน้าแรก เกี่ยวกับเรา คำนำหน้ารายการ และท้ายเว็บ) ในหน้าข้อมูลบริษัท
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ช่องที่มีเครื่องหมายบังคับต้องกรอก ช่องอื่นเว้นว่างเพื่อซ่อนจากหน้าเว็บได้
 */
"use client";
import { COPY_ITEM_LIMITS, DEFAULT_SITE_COPY, HIGHLIGHT_LIMIT, isSampleStats, PROCESS_STEP_LIMIT, STAT_LIMIT, STAT_LIMITS, siteCopyTextFields, type CopyItem, type SiteCopy, type StatItem } from "@/lib/site-copy";
import { FormSection } from "./editor-ui";
import { formText } from "@/lib/form-data";

const groups = [...new Set(siteCopyTextFields.map(field => field.group))];
const lists = [
  { key: "highlights", label: "จุดเด่นใต้ภาพหน้าแรก (แสดงเมื่อไม่มีตัวเลขในหน้าแรก)", item: "จุดเด่น", limit: HIGHLIGHT_LIMIT },
  { key: "processSteps", label: "ขั้นตอนการทำงานในหน้าแรก", item: "ขั้นตอน", limit: PROCESS_STEP_LIMIT },
] as const;

/** ค่าที่ใช้เติมฟอร์ม: ข้อความที่บันทึกไว้ หรือค่าเริ่มต้นถ้ายังไม่เคยบันทึก (เซิร์ฟเวอร์ตรวจซ้ำตอนบันทึก) */
export function initialSiteCopy(stored: unknown): SiteCopy {
  return stored && typeof stored === "object" && !Array.isArray(stored) ? { ...DEFAULT_SITE_COPY, ...(stored as Partial<SiteCopy>) } : DEFAULT_SITE_COPY;
}

/** อ่านข้อความจากฟอร์ม; แถวรายการที่ว่างทั้งแถวจะถูกตัดออก แถวที่มีคำอธิบายแต่ไม่มีหัวข้อถือว่าไม่ถูกต้อง */
export function readSiteCopy(form: FormData): { copy: SiteCopy } | { error: string } {
  const value = (name: string) => formText(form, name).trim();
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
  const stats: StatItem[] = [];
  for (let index = 0; index < STAT_LIMIT; index += 1) {
    const raw = value(`copy.stats.${index}.value`).replaceAll(",", "");
    const suffix = value(`copy.stats.${index}.suffix`);
    const label = value(`copy.stats.${index}.label`);
    if (!raw && !suffix && !label) continue;
    if (!/^\d{1,7}$/.test(raw)) return { error: `ตัวเลขที่ ${index + 1} ต้องเป็นจำนวนเต็ม 0–${STAT_LIMITS.value.toLocaleString("en-US")}` };
    if (!label) return { error: `ตัวเลขที่ ${index + 1} ต้องมีคำอธิบาย` };
    stats.push({ value: Number(raw), suffix, label });
  }
  result.stats = stats;
  return { copy: result as SiteCopy };
}

/** สร้างส่วนหน้าจอ SiteCopyFields สำหรับแก้ข้อความบนหน้าเว็บ */
export function SiteCopyFields({ initial }: Readonly<{ initial: SiteCopy }>) {
  return (
    <FormSection title="ข้อความบนหน้าเว็บ" description="เว้นว่างเพื่อซ่อนข้อความนั้น กด Enter ในหัวข้อเพื่อขึ้นบรรทัดใหม่">
      {groups.map(group => (
        <fieldset className="copy-group" key={group}>
          <legend>{group}</legend>
          <div className="form-stack flush">
            {siteCopyTextFields.filter(field => field.group === group).map(field => (
              <div className="form-group" key={field.key}>
                <label className={field.required ? "required" : ""} htmlFor={`copy-${field.key}`}>{field.label}</label>
                <textarea id={`copy-${field.key}`} name={`copy.${field.key}`} className="field" rows={2} maxLength={field.max} required={field.required} defaultValue={initial[field.key]} />
              </div>
            ))}
            {group === "หน้าแรก" && <StatFields initial={initial.stats} />}
            {group === "หน้าแรก" && lists.map(list => (
              <div className="copy-list" key={list.key}>
                <p className="copy-list-title">{list.label} <span>สูงสุด {list.limit} รายการ</span></p>
                {Array.from({ length: list.limit }, (_, index) => (
                  <div className="copy-item" key={index}>
                    <span className="copy-item-number" aria-hidden="true">{index + 1}</span>
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
          </div>
        </fieldset>
      ))}
    </FormSection>
  );
}

/** ตัวเลขนับขึ้นในหน้าแรก ค่าเริ่มต้นเป็นตัวอย่าง จึงเตือนจนกว่าจะแก้เป็นตัวเลขจริง */
function StatFields({ initial }: Readonly<{ initial: StatItem[] }>) {
  return (
    <div className="copy-list">
      <p className="copy-list-title">ตัวเลขในหน้าแรก <span>สูงสุด {STAT_LIMIT} รายการ แสดงในกล่องขาวใต้ภาพหน้าแรกและนับขึ้นเมื่อปรากฏบนจอ ลบออกหมดเพื่อกลับไปใช้จุดเด่นแทน</span></p>
      {isSampleStats(initial) && (
        <p className="auth-alert warning" role="note">ตอนนี้เป็นตัวเลขตัวอย่าง ต้องแก้เป็นตัวเลขจริงของบริษัทก่อนเปิดเว็บ หรือลบออกให้หมดเพื่อใช้จุดเด่นแทน</p>
      )}
      {Array.from({ length: STAT_LIMIT }, (_, index) => (
        <div className="copy-item stat-item" key={index}>
          <span className="copy-item-number" aria-hidden="true">{index + 1}</span>
          <div className="form-group">
            <label htmlFor={`copy-stats-${index}-value`}>ตัวเลขที่ {index + 1} — จำนวน</label>
            <input id={`copy-stats-${index}-value`} name={`copy.stats.${index}.value`} className="field" inputMode="numeric" pattern="[0-9,]*" maxLength={9} defaultValue={initial[index]?.value ?? ""} />
          </div>
          <div className="form-group">
            <label htmlFor={`copy-stats-${index}-suffix`}>หน่วยหรือเครื่องหมาย</label>
            <input id={`copy-stats-${index}-suffix`} name={`copy.stats.${index}.suffix`} className="field" maxLength={STAT_LIMITS.suffix} placeholder="เช่น + หรือ ปี" defaultValue={initial[index]?.suffix ?? ""} />
          </div>
          <div className="form-group">
            <label htmlFor={`copy-stats-${index}-label`}>ตัวเลขที่ {index + 1} — คำอธิบาย</label>
            <input id={`copy-stats-${index}-label`} name={`copy.stats.${index}.label`} className="field" maxLength={STAT_LIMITS.label} defaultValue={initial[index]?.label ?? ""} />
          </div>
        </div>
      ))}
    </div>
  );
}
