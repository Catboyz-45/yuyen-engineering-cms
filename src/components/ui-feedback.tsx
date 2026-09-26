/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React ui-feedback ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import type { RefObject } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import { FLASH_EVENT, takeFlashMessage } from "@/lib/client-flash";

export type ToastTone = "success" | "info" | "warning" | "error";
type Toast = { id: number; message: string; tone: ToastTone };
type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
};
type PendingConfirmation = ConfirmOptions & { resolve: (confirmed: boolean) => void };

type UIContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const UIContext = createContext<UIContextValue | null>(null);

/** สร้างส่วนหน้าจอ UIProvider; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function UIProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const toastId = useRef(0);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLDialogElement>(null);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, message, tone }]);
    const duration = tone === "error" || tone === "warning" ? 6500 : 4500;
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), duration);
  }, []);

  useEffect(() => {
    const showFlash = () => {
      const flash = takeFlashMessage();
      if (flash) toast(flash.message, flash.tone);
    };
    showFlash();
    window.addEventListener(FLASH_EVENT, showFlash);
    return () => window.removeEventListener(FLASH_EVENT, showFlash);
  }, [toast]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setConfirmation({ ...options, resolve });
  }), []);

  const closeConfirmation = useCallback((confirmed: boolean) => {
    setConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toastItem) => toastItem.id !== id)), []);
  return <UIContext.Provider value={value}>{children}<section className="toast-region" aria-label="การแจ้งเตือน">{toasts.map((item) => <ToastItem key={item.id} item={item} onDismiss={dismiss} />)}</section>{confirmation && <ConfirmationDialog confirmation={confirmation} dialogRef={confirmationRef} cancelRef={cancelButtonRef} onClose={closeConfirmation} />}</UIContext.Provider>;
}

const toastIcons: Record<ToastTone, typeof Info> = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: AlertCircle };

/** ข้อผิดพลาดและคำเตือนอ่านออกเสียงทันที (alert) ส่วนข้อความทั่วไปรอให้ผู้ใช้อ่านจบก่อน (output) */
function ToastItem({ item, onDismiss }: Readonly<{ item: Toast; onDismiss: (id: number) => void }>) {
  const Icon = toastIcons[item.tone];
  const className = `toast toast-${item.tone}`;
  const content = <><span className="toast-icon" aria-hidden="true"><Icon size={19} /></span><span>{item.message}</span><button type="button" className="icon-btn" onClick={() => onDismiss(item.id)} aria-label="ปิดการแจ้งเตือน"><X size={16} /></button></>;
  if (item.tone === "error" || item.tone === "warning") return <div className={className} role="alert" aria-live="assertive">{content}</div>;
  return <output className={className} aria-live="polite">{content}</output>;
}

function ConfirmationDialog({ confirmation, dialogRef, cancelRef, onClose }: Readonly<{ confirmation: PendingConfirmation; dialogRef: RefObject<HTMLDialogElement | null>; cancelRef: RefObject<HTMLButtonElement | null>; onClose: (confirmed: boolean) => void }>) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(false), [onClose]);
  useModalAccessibility({ containerRef: dialogRef, backdropRef, initialFocusRef: cancelRef, onClose: close });
  const danger = confirmation.tone === "danger";
  return <div ref={backdropRef} className="dialog-backdrop"><dialog open ref={dialogRef} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" tabIndex={-1}><span className={`dialog-icon ${danger ? "danger" : ""}`}><AlertTriangle size={24} /></span><h2 id="confirm-title">{confirmation.title}</h2><p id="confirm-description">{confirmation.description}</p><div className="dialog-actions"><button type="button" ref={cancelRef} className="btn btn-outline" onClick={close}>ยกเลิก</button><button type="button" className={`btn ${danger ? "btn-danger" : "btn-dark"}`} onClick={() => onClose(true)}>{confirmation.confirmLabel ?? "ยืนยัน"}</button></div></dialog></div>;
}

/** React Hook useUI รวม state และพฤติกรรมฝั่ง browser เพื่อให้คอมโพเนนต์เรียกใช้ตามกฎเดียวกัน */
export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used inside UIProvider");
  return context;
}
