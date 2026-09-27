/**
 * หน้าที่ของไฟล์นี้: React Hook use-modal-accessibility สำหรับรวมพฤติกรรมฝั่งเบราว์เซอร์ที่หลายคอมโพเนนต์เรียกใช้ร่วมกัน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";

const focusableSelector = [
  "a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

// Safari ไม่ย้ายโฟกัสไปที่ปุ่มเมื่อคลิกด้วยเมาส์ (document.activeElement ยังเป็น body) ตอนปิดหน้าต่างจึงคืนโฟกัสไม่ถูกที่
// จำปุ่มหรือลิงก์ที่กดล่าสุดไว้เป็นทางสำรอง ผู้ใช้คีย์บอร์ดจะกลับมาที่ปุ่มเดิมได้ในทุกเบราว์เซอร์
// ปุ่มที่กดก่อนหน้าต่างเปิดไม่เกินเวลานี้ถือว่าเป็นปุ่มที่เปิดหน้าต่าง
const PRESS_OPENS_DIALOG_MS = 1500;
let lastPressed: { element: HTMLElement; at: number } | null = null;
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", event => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(focusableSelector) : null;
    if (element) lastPressed = { element, at: Date.now() };
  }, true);
}
/** ใช้คืนโฟกัสได้เฉพาะ element จริงที่ยังอยู่ในหน้า ไม่ใช่ body */
function focusTarget(element: HTMLElement | null | undefined) {
  return element && element !== document.body && element.isConnected ? element : null;
}

type ModalAccessibilityOptions = {
  active?: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** ฉากหลังของหน้าต่าง: กดที่ฉากหลัง (นอกหน้าต่าง) แล้วปิดหน้าต่าง */
  backdropRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  closeDisabled?: boolean;
};

/** React Hook useModalAccessibility รวม state และพฤติกรรมฝั่ง browser เพื่อให้คอมโพเนนต์เรียกใช้ตามกฎเดียวกัน */
export function useModalAccessibility({ active = true, containerRef, initialFocusRef, restoreFocusRef, backdropRef, onClose, closeDisabled = false }: ModalAccessibilityOptions) {
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { closeDisabledRef.current = closeDisabled; }, [closeDisabled]);
  useEffect(() => {
    if (!active) {
      const rememberFocus = (event: FocusEvent) => {
        if (
          event.target instanceof HTMLElement &&
          !containerRef.current?.contains(event.target)
        ) returnFocusRef.current = event.target;
      };
      if (document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
      document.addEventListener("focusin", rememberFocus);
      return () => document.removeEventListener("focusin", rememberFocus);
    }
    // Dialogs mounted already active never pass through the inactive branch; focus is still on the trigger here.
    const mountFocus = document.activeElement instanceof HTMLElement && !containerRef.current?.contains(document.activeElement) ? document.activeElement : null;
    const pressed = lastPressed && Date.now() - lastPressed.at < PRESS_OPENS_DIALOG_MS && !containerRef.current?.contains(lastPressed.element) ? lastPressed.element : null;
    // ปุ่มที่เพิ่งกดมาก่อน: ใน Safari ค่าอื่นเป็นแค่ element ที่เคยโฟกัสไว้ก่อนหน้า (เช่น main) ไม่ใช่ปุ่มที่เปิดหน้าต่าง
    const previousFocus = focusTarget(pressed) ?? focusTarget(restoreFocusRef?.current) ?? focusTarget(returnFocusRef.current) ?? focusTarget(mountFocus);
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      if (containerRef.current?.contains(document.activeElement)) return;
      const target = initialFocusRef?.current ?? containerRef.current?.querySelector<HTMLElement>("[autofocus]") ?? containerRef.current?.querySelector<HTMLElement>(focusableSelector) ?? containerRef.current;
      target?.focus();
    };
    const frame = window.requestAnimationFrame(focusInitial);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!closeDisabledRef.current) { event.preventDefault(); onCloseRef.current(); }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(containerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
        .filter(element => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) { event.preventDefault(); containerRef.current?.focus(); return; }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !containerRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    const handleBackdropPointer = (event: MouseEvent) => {
      if (!closeDisabledRef.current && backdropRef?.current && event.target === backdropRef.current) onCloseRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleBackdropPointer);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleBackdropPointer);
      document.body.style.overflow = bodyOverflow;
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
      });
    };
  }, [active, containerRef, initialFocusRef, restoreFocusRef, backdropRef]);
}
