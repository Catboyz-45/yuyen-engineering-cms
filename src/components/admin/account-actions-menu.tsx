/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React account-actions-menu ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { CSSProperties, KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { focusIsAround, focusNextFrame } from "@/lib/focus";

type MenuAction = { label: string; disabled?: boolean; onSelect: () => void };

/** ตำแหน่งรายการถัดไปในเมนูเมื่อกดปุ่มลูกศร/Home/End (วนรอบ และข้ามรายการที่ปิดใช้งาน) */
function nextMenuIndex(key: string, enabled: number[], position: number) {
  if (key === "Home") return enabled[0];
  if (key === "End") return enabled.at(-1) ?? enabled[0];
  const step = key === "ArrowDown" ? 1 : -1;
  return enabled[(position + step + enabled.length) % enabled.length];
}

/** สร้างส่วนหน้าจอ AccountActionsMenu; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AccountActionsMenu({ userName, actions }: Readonly<{ userName: string; actions: MenuAction[] }>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [placement, setPlacement] = useState<CSSProperties>();
  const menuId = useId();
  const enabledIndexes = actions.flatMap((action, index) => action.disabled ? [] : [index]);

  const focusItem = (index: number) => focusNextFrame(() => itemRefs.current[index], () => rootRef.current, { preventScroll: true });
  // ไม่มีรายการที่กดได้ (เช่นบัญชีตัวเอง): โฟกัสที่ตัวเมนูแทน โปรแกรมอ่านหน้าจอจึงอ่านเมนูได้และกด Escape ปิดได้
  const openMenu = () => {
    setOpen(true);
    if (enabledIndexes.length) focusItem(enabledIndexes[0]);
    else focusNextFrame(() => menuRef.current, () => rootRef.current, { preventScroll: true });
  };
  const closeMenu = (restoreFocus = false) => { setOpen(false); if (restoreFocus) focusNextFrame(() => triggerRef.current, () => rootRef.current); };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    // Escape ปิดเมนูได้เสมอ แม้โฟกัสยังไม่ได้ย้ายเข้าเมนู (ยังอยู่ที่ปุ่ม หรือที่กรอบตารางเมื่อคลิกใน Safari)
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !focusIsAround(rootRef.current)) return;
      event.preventDefault();
      closeMenu(true);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // เมนูอยู่ในกรอบตารางที่เลื่อนซ้าย-ขวาได้ ซึ่งตัดทุกอย่างที่ล้นกรอบ จึงวางเมนูแบบ fixed ตามตำแหน่งปุ่มบนจอ
  // และเปิดขึ้นด้านบนเมื่อด้านล่างมีที่ไม่พอ
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const height = menuRef.current?.offsetHeight ?? 0;
      if (!trigger) return;
      const below = trigger.bottom + 6;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, trigger.top - 6 - height) : below;
      setPlacement({ top, right: Math.max(8, window.innerWidth - trigger.right) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); openMenu(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); if (enabledIndexes.length) focusItem(enabledIndexes.at(-1)!); }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") { closeMenu(false); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!enabledIndexes.length) return;
    const current = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement | null);
    const next = nextMenuIndex(event.key, enabledIndexes, Math.max(0, enabledIndexes.indexOf(current)));
    itemRefs.current[next]?.focus();
  }

  return <div className="account-menu" ref={rootRef}>
    <button ref={triggerRef} className="icon-btn" type="button" aria-label={`เมนู ${userName}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => open ? closeMenu(false) : openMenu()} onKeyDown={handleTriggerKeyDown}><MoreHorizontal size={17} /></button>
    {open && <div ref={menuRef} className="account-menu-items" style={placement} id={menuId} role="menu" tabIndex={-1} aria-label={`การจัดการ ${userName}`} onKeyDown={handleMenuKeyDown}>
      {actions.map((action, index) => <button ref={element => { itemRefs.current[index] = element; }} key={action.label} type="button" role="menuitem" tabIndex={-1} disabled={action.disabled} onClick={() => { closeMenu(false); action.onSelect(); }}>{action.label}</button>)}
    </div>}
  </div>;
}
