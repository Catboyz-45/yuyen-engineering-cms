/**
 * หน้าที่ของไฟล์นี้: ช่องเลือกวันที่ (และเวลา) ในหน้าแก้ไขเนื้อหา แทนปฏิทินในตัวของเบราว์เซอร์ที่หน้าตาไม่เข้ากับเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: แสดงวันที่แบบไทย (พ.ศ.) ทั้งในช่องและในปฏิทิน เลือกเวลาเป็นชั่วโมงและนาทีแบบ 24 ชั่วโมง
 * ค่าที่ส่งไปกับฟอร์มเป็นเวลาท้องถิ่นของผู้ใช้ (ปี ค.ศ.) รูปแบบเดิม ฝั่งเซิร์ฟเวอร์จึงไม่ต้องเปลี่ยน
 * ใช้คีย์บอร์ดได้: ลูกศรเลื่อนวัน Page Up/Down เปลี่ยนเดือน Home/End ไปต้น/ท้ายสัปดาห์ Enter เลือก Esc ปิด
 */
"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ThemeSelect } from "../theme-select";

type Day = { year: number; month: number; day: number };
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTE_STEPS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

const pad = (value: number) => String(value).padStart(2, "0");
const toDate = (day: Day) => new Date(day.year, day.month, day.day);
const fromDate = (date: Date): Day => ({ year: date.getFullYear(), month: date.getMonth(), day: date.getDate() });
const sameDay = (a: Day | null, b: Day | null) => Boolean(a && b && a.year === b.year && a.month === b.month && a.day === b.day);
const addDays = (day: Day, amount: number) => fromDate(new Date(day.year, day.month, day.day + amount));
/** เลื่อนเดือนโดยคงวันที่ไว้ (31 ม.ค. + 1 เดือน = 28/29 ก.พ.) */
function addMonths(day: Day, amount: number): Day {
  const lastDay = new Date(day.year, day.month + amount + 1, 0).getDate();
  return fromDate(new Date(day.year, day.month + amount, Math.min(day.day, lastDay)));
}
const longDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" });
const monthTitle = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

/** อ่านค่าเริ่มต้น: เวลาจากฐานข้อมูล (ISO) แปลงเป็นเวลาท้องถิ่น ส่วนวันที่อย่างเดียวใช้ปี-เดือน-วันตรงๆ ไม่ให้เลื่อนตามเขตเวลา */
function parseInitial(value: string, withTime: boolean): { day: Day | null; hour: string; minute: string } {
  const empty = { day: null, hour: "09", minute: "00" };
  if (!value) return empty;
  if (!withTime) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return match ? { ...empty, day: { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } } : empty;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  return { day: fromDate(date), hour: pad(date.getHours()), minute: pad(date.getMinutes()) };
}

export function DateTimeField({
  name,
  label,
  defaultValue,
  withTime = false,
  help,
  error,
  onDirty,
}: Readonly<{
  name: string;
  label: string;
  defaultValue: string;
  withTime?: boolean;
  help?: string;
  error?: string;
  onDirty?: () => void;
}>) {
  const initial = parseInitial(defaultValue, withTime);
  const [selected, setSelected] = useState<Day | null>(initial.day);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<Day>(initial.day ?? fromDate(new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const helpId = `${name}-help`;
  const errorId = `${name}-error`;
  const today = fromDate(new Date());

  const value = selected
    ? `${selected.year}-${pad(selected.month + 1)}-${pad(selected.day)}${withTime ? `T${hour}:${minute}` : ""}`
    : "";

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  // ปฏิทินที่เปิดลงไปเลยขอบล่างของจอ: เลื่อนหน้าให้เห็นทั้งปฏิทิน ไม่ต้องเลื่อนหาเอง
  useEffect(() => {
    if (open) gridRef.current?.closest(".date-picker-popover")?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [open]);

  // ย้ายโฟกัสไปวันที่กำลังเลือกทุกครั้งที่เปิดปฏิทินหรือเลื่อนด้วยคีย์บอร์ด
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true });
  }, [open, focused]);

  function change(next: () => void) {
    next();
    onDirty?.();
  }
  function choose(day: Day) {
    change(() => setSelected(day));
    setFocused(day);
    setOpen(false);
    triggerRef.current?.focus();
  }
  function toggle() {
    setFocused(selected ?? today);
    setOpen(value => !value);
  }
  function onGridKey(event: KeyboardEvent) {
    const moves: Record<string, () => Day> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -toDate(focused).getDay()),
      End: () => addDays(focused, 6 - toDate(focused).getDay()),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    };
    if (moves[event.key]) {
      event.preventDefault();
      setFocused(moves[event.key]());
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  // ตารางวันของเดือนที่กำลังดู เริ่มวันอาทิตย์ มีวันของเดือนก่อน/ถัดไปเติมให้ครบสัปดาห์
  const first = new Date(focused.year, focused.month, 1);
  const cells = Array.from({ length: 42 }, (_, index) => fromDate(new Date(focused.year, focused.month, index - first.getDay() + 1)));
  const weeks = Array.from({ length: 6 }, (_, week) => cells.slice(week * 7, week * 7 + 7)).filter(week => week.some(day => day.month === focused.month));
  const minuteOptions = MINUTE_STEPS.includes(minute) ? MINUTE_STEPS : [...MINUTE_STEPS, minute].sort();
  const describedBy = [help ? helpId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className="form-group date-time-field" ref={rootRef}>
      <label htmlFor={name}>{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="date-time-row">
        <div className="date-picker">
          <button
            ref={triggerRef}
            id={name}
            type="button"
            className={`date-picker-trigger${error ? " invalid" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? popoverId : undefined}
            aria-describedby={describedBy}
            onClick={toggle}
          >
            <CalendarDays size={18} aria-hidden="true" />
            <span className={selected ? undefined : "date-picker-placeholder"}>{selected ? longDate.format(toDate(selected)) : "เลือกวันที่"}</span>
          </button>
          {open && (
            <div id={popoverId} className="date-picker-popover" role="dialog" aria-label={`เลือก${label}`}>
              <div className="date-picker-head">
                <button type="button" className="icon-btn" aria-label="เดือนก่อนหน้า" onClick={() => setFocused(addMonths(focused, -1))}><ChevronLeft size={17} /></button>
                <strong aria-live="polite">{monthTitle.format(first)}</strong>
                <button type="button" className="icon-btn" aria-label="เดือนถัดไป" onClick={() => setFocused(addMonths(focused, 1))}><ChevronRight size={17} /></button>
              </div>
              <div ref={gridRef} className="date-picker-grid" role="grid" onKeyDown={onGridKey}>
                <div role="row" className="date-picker-week">
                  {WEEKDAYS.map(day => <span role="columnheader" key={day}>{day}</span>)}
                </div>
                {weeks.map(week => (
                  <div role="row" className="date-picker-week" key={`${week[0].year}-${week[0].month}-${week[0].day}`}>
                    {week.map(day => (
                      <span role="gridcell" key={`${day.month}-${day.day}`} aria-selected={sameDay(day, selected)}>
                        <button
                          type="button"
                          tabIndex={sameDay(day, focused) ? 0 : -1}
                          className={["date-picker-day", day.month !== focused.month ? "outside" : "", sameDay(day, selected) ? "selected" : "", sameDay(day, today) ? "today" : ""].filter(Boolean).join(" ")}
                          aria-label={longDate.format(toDate(day))}
                          aria-current={sameDay(day, today) ? "date" : undefined}
                          onClick={() => choose(day)}
                        >
                          {day.day}
                        </button>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="date-picker-foot">
                <button type="button" className="btn btn-ghost" onClick={() => choose(today)}>วันนี้</button>
              </div>
            </div>
          )}
        </div>
        {withTime && (
          <div className="time-picker" role="group" aria-label="เวลา (24 ชั่วโมง)">
            <ThemeSelect label="ชั่วโมง" value={hour} options={HOURS.map(value => ({ value, label: value }))} onValueChange={next => change(() => setHour(next))} disabled={!selected} />
            <span aria-hidden="true">:</span>
            <ThemeSelect label="นาที" value={minute} options={minuteOptions.map(value => ({ value, label: value }))} onValueChange={next => change(() => setMinute(next))} disabled={!selected} />
            <span className="time-picker-unit">น.</span>
          </div>
        )}
        {selected && (
          <button type="button" className="icon-btn" aria-label={`ล้าง${label}`} title="ล้างค่า" onClick={() => change(() => setSelected(null))}>
            <X size={16} />
          </button>
        )}
      </div>
      {help && <p className="help" id={helpId}>{help}</p>}
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  );
}
