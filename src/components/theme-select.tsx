/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React theme-select ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { Check, ChevronDown } from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { themeSelectNavigationIndex, type ThemeSelectNavigationKey } from "@/lib/theme-select-keyboard";

export type ThemeSelectOption = { label: string; value: string };

type ThemeSelectProps = {
  /** ไม่ใส่ name เมื่อใช้เป็นตัวกรองที่ควบคุมค่าเองโดยไม่ส่งไปกับฟอร์ม */
  name?: string;
  label: string;
  options: ThemeSelectOption[];
  defaultValue?: string;
  /** ควบคุมค่าจากภายนอก (ใช้คู่กับ onValueChange) */
  value?: string;
  onValueChange?: (value: string) => void;
  /** ข้อความเมื่อยังไม่ได้เลือก เช่น "เลือกยี่ห้อ" ถ้าไม่ใส่จะเลือกตัวเลือกแรกให้ */
  placeholder?: string;
  /** id ของปุ่ม เพื่อให้ <label htmlFor> ชี้มาที่ dropdown ได้ */
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
};

/** สร้างส่วนหน้าจอ ThemeSelect; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ThemeSelect({ name, label, options, defaultValue = "", value: controlledValue, onValueChange, placeholder, id, disabled, invalid, describedBy, className }: Readonly<ThemeSelectProps>) {
  const defaultIndex = options.findIndex(option => option.value === defaultValue);
  const initialIndex = Math.max(0, defaultIndex);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultIndex >= 0 || placeholder === undefined ? options[initialIndex]?.value ?? "" : "");
  const value = controlledValue ?? uncontrolledValue;
  const setValue = useCallback((next: string) => {
    if (controlledValue === undefined) setUncontrolledValue(next);
    onValueChange?.(next);
  }, [controlledValue, onValueChange]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRef = useRef("");
  const searchTimerRef = useRef<number | null>(null);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const matchedIndex = options.findIndex(option => option.value === value);
  const selectedIndex = Math.max(0, matchedIndex);
  const selected = matchedIndex >= 0 ? options[matchedIndex] : undefined;

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setActiveIndex(selectedIndex);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [selectedIndex]);

  const openAt = useCallback((index: number) => {
    if (!options.length) return;
    setActiveIndex(Math.min(Math.max(index, 0), options.length - 1));
    setOpen(true);
  }, [options.length]);

  const choose = useCallback((index: number) => {
    const option = options[index];
    if (!option) return;
    setValue(option.value);
    setActiveIndex(index);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [options, setValue]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const preventSafariPageScroll = (event: globalThis.KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End", " "].includes(event.key)) return;
      if (!rootRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
    };
    window.addEventListener("keydown", preventSafariPageScroll, { capture: true, passive: false });
    window.addEventListener("keyup", preventSafariPageScroll, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", preventSafariPageScroll, true);
      window.removeEventListener("keyup", preventSafariPageScroll, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const option = optionRefs.current[activeIndex];
    if (!menu || !option) return;
    const optionTop = option.offsetTop;
    const optionBottom = optionTop + option.offsetHeight;
    const visibleTop = menu.scrollTop;
    const visibleBottom = visibleTop + menu.clientHeight;
    if (optionTop < visibleTop) menu.scrollTop = optionTop;
    else if (optionBottom > visibleBottom) menu.scrollTop = optionBottom - menu.clientHeight;
  }, [activeIndex, open]);

  useEffect(() => () => {
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current);
  }, []);

  function typeahead(key: string) {
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current);
    searchRef.current += key.toLocaleLowerCase("th-TH");
    searchTimerRef.current = window.setTimeout(() => { searchRef.current = ""; }, 700);
    const start = open ? activeIndex + 1 : selectedIndex + 1;
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + offset) % options.length;
      if (options[index].label.toLocaleLowerCase("th-TH").startsWith(searchRef.current)) {
        openAt(index);
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const nextIndex = themeSelectNavigationIndex(event.key, { open, activeIndex, selectedIndex, optionCount: options.length });
      if (nextIndex !== null) openAt(nextIndex);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      const nextIndex = themeSelectNavigationIndex(event.key as ThemeSelectNavigationKey, { open, activeIndex, selectedIndex, optionCount: options.length });
      if (nextIndex !== null) openAt(nextIndex);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex); else openAt(selectedIndex);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      typeahead(event.key);
    }
  }

  return <div className={["theme-select", className].filter(Boolean).join(" ")} ref={rootRef}>
    {name && <input type="hidden" name={name} value={value} />}
    <button ref={triggerRef} id={id} className="theme-select-trigger" type="button" role="combobox" aria-label={id ? undefined : label} disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-activedescendant={open ? optionId(activeIndex) : undefined} onClick={() => open ? close(false) : openAt(selectedIndex)} onKeyDown={handleKeyDown} onKeyUp={event => {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) event.preventDefault();
    }}>
      <span className={selected ? undefined : "theme-select-placeholder"}>{selected?.label ?? placeholder}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <div ref={menuRef} className="theme-select-menu" id={listId} role="listbox" aria-label={label}>
      {options.map((option, index) => <button ref={element => { optionRefs.current[index] = element; }} id={optionId(index)} key={option.value} className="theme-select-option" type="button" role="option" tabIndex={-1} aria-selected={option.value === value} data-active={index === activeIndex || undefined} onPointerMove={() => setActiveIndex(index)} onClick={() => choose(index)}>
        <span>{option.label}</span>{option.value === value && <Check size={17} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
