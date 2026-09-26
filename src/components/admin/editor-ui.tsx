/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React editor-ui ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  FileText,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";

/** สร้างส่วนหน้าจอ FormSection; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function FormSection({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="form-section">
      <div className="form-section-head">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "ready" | "error";
  preview?: string;
  file?: File;
  error?: string;
  newlyUploaded?: boolean;
  altText?: string;
  altStatus?: "saving" | "saved" | "error";
};
type UploadControl = {
  controller: AbortController;
  xhr?: XMLHttpRequest;
  mediaId?: string;
  cancelled: boolean;
};
function putFile(
  url: string,
  file: File,
  onProgress: (value: number) => void,
  control: UploadControl,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    control.xhr = xhr;
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 85));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("อัปโหลดไปยังพื้นที่จัดเก็บไม่สำเร็จ"));
    xhr.onerror = () => reject(new Error("การเชื่อมต่อขัดข้อง"));
    xhr.onabort = () =>
      reject(new DOMException("ยกเลิกการอัปโหลดแล้ว", "AbortError"));
    xhr.send(file);
  });
}

/** สร้างส่วนหน้าจอ MediaUploader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function MediaUploader({
  name,
  title = "รูปภาพ",
  multiple = true,
  pdf = false,
  describe = true,
  max,
  initial = [],
  onDirty,
}: Readonly<{
  name: string;
  title?: string;
  multiple?: boolean;
  pdf?: boolean;
  /** false สำหรับรูปตกแต่งที่มีข้อความเดียวกันอยู่ข้างๆ เช่น โลโก้ข้างชื่อบริษัท จึงไม่ต้องมีคำอธิบายรูป */
  describe?: boolean;
  /** จำนวนไฟล์สูงสุด แสดงต่อท้ายหัวข้อ และไม่รับไฟล์เกินจำนวนนี้ */
  max?: number;
  initial?: { id: string; name: string; preview?: string; altText?: string }[];
  onDirty?: () => void;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef(new Map<string, UploadControl>());
  const [files, setFiles] = useState<UploadItem[]>(
    initial.map((item) => ({ ...item, progress: 100, status: "ready" })),
  );
  const [limitNotice, setLimitNotice] = useState("");
  const limit = multiple ? (max ?? 30) : 1;
  // ไฟล์ที่อัปโหลดไม่สำเร็จไม่ถูกบันทึก จึงไม่นับรวม
  const used = files.filter((item) => item.status !== "error").length;
  const full = multiple && used >= limit;
  const label = max ? `${title} (สูงสุด ${max} ${pdf ? "ไฟล์" : "รูป"})` : title;
  const accepted = pdf
    ? "application/pdf,.pdf"
    : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  async function upload(file: File, localId = crypto.randomUUID()) {
    const max = pdf ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
    const allowed = pdf
      ? ["application/pdf"]
      : ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size <= 0 || file.size > max) {
      setFiles((current) => [
        ...current.filter((item) => item.id !== localId),
        {
          id: localId,
          name: file.name,
          progress: 0,
          status: "error",
          file,
          error: `ชนิดไฟล์ไม่ถูกต้องหรือเกิน ${pdf ? 20 : 10} MB`,
        },
      ]);
      return;
    }
    const previous = controlsRef.current.get(localId);
    previous?.controller.abort();
    previous?.xhr?.abort();
    const control: UploadControl = {
      controller: new AbortController(),
      cancelled: false,
    };
    controlsRef.current.set(localId, control);
    const preview = pdf ? undefined : URL.createObjectURL(file);
    setFiles((current) => [
      ...current.filter((item) => item.id !== localId),
      {
        id: localId,
        name: file.name,
        progress: 2,
        status: "uploading",
        file,
        preview,
      },
    ]);
    try {
      const start = await fetch("/api/admin/media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
        signal: control.controller.signal,
      });
      const signed = await start.json();
      if (!start.ok) throw new Error(signed.error ?? "เริ่มอัปโหลดไม่สำเร็จ");
      control.mediaId = signed.mediaId;
      if (control.cancelled) {
        await cancelServerUpload(signed.mediaId);
        return;
      }
      await putFile(
        signed.uploadUrl,
        file,
        (progress) =>
          setFiles((current) =>
            current.map((item) =>
              item.id === localId ? { ...item, progress } : item,
            ),
          ),
        control,
      );
      setFiles((current) =>
        current.map((item) =>
          item.id === localId ? { ...item, progress: 90 } : item,
        ),
      );
      const complete = await fetch(
        `/api/admin/media/uploads/${signed.mediaId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: control.controller.signal,
        },
      );
      const result = await complete.json();
      if (!complete.ok)
        throw new Error(result.error ?? "ประมวลผลไฟล์ไม่สำเร็จ");
      if (control.cancelled) {
        await cancelServerUpload(result.mediaId);
        return;
      }
      controlsRef.current.delete(localId);
      setFiles((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                id: result.mediaId,
                progress: 100,
                status: "ready",
                file: undefined,
                preview: `/api/media/${result.mediaId}?width=640`,
                newlyUploaded: true,
              }
            : item,
        ),
      );
    } catch (caughtError) {
      if (
        control.cancelled ||
        (caughtError instanceof DOMException && caughtError.name === "AbortError")
      )
        return;
      setFiles((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                status: "error",
                error:
                  caughtError instanceof Error ? caughtError.message : "อัปโหลดไม่สำเร็จ",
              }
            : item,
        ),
      );
    }
  }
  async function saveAltText(file: UploadItem) {
    if (file.status !== "ready") return;
    setFiles((current) =>
      current.map((item) =>
        item.id === file.id ? { ...item, altStatus: "saving" } : item,
      ),
    );
    const response = await fetch(`/api/admin/media/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ altText: file.altText?.trim() || null }),
    });
    setFiles((current) =>
      current.map((item) =>
        item.id === file.id
          ? { ...item, altStatus: response.ok ? "saved" : "error" }
          : item,
      ),
    );
  }
  function remove(file: UploadItem) {
    onDirty?.();
    setLimitNotice("");
    const control = controlsRef.current.get(file.id);
    if (control) {
      control.cancelled = true;
      control.controller.abort();
      control.xhr?.abort();
      controlsRef.current.delete(file.id);
      if (control.mediaId) void cancelServerUpload(control.mediaId);
    } else if (file.newlyUploaded) void cancelServerUpload(file.id);
    if (file.preview?.startsWith("blob:")) URL.revokeObjectURL(file.preview);
    setFiles((items) => items.filter((item) => item.id !== file.id));
  }
  function select(selected: FileList | null) {
    if (!selected?.length) return;
    onDirty?.();
    const room = multiple ? limit - used : 1;
    if (room <= 0) {
      setLimitNotice(`ใส่ได้สูงสุด ${limit} รูป ลบรูปเดิมก่อนจึงเพิ่มรูปใหม่ได้`);
      return;
    }
    const next = [...selected].slice(0, room);
    setLimitNotice(
      selected.length > room
        ? `ใส่ได้อีก ${room} รูป ระบบจึงอัปโหลดเฉพาะ ${room} ไฟล์แรกจาก ${selected.length} ไฟล์ที่เลือก`
        : "",
    );
    if (!multiple) files.forEach(remove);
    for (const file of next) void upload(file);
  }
  const busy = files.some((item) => item.status === "uploading");
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        aria-label={label}
        accept={accepted}
        multiple={multiple}
        onChange={(event) => {
          select(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        className="dropzone"
        type="button"
        disabled={(busy && !multiple) || full}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          select(event.dataTransfer.files);
        }}
      >
        <span>
          <Upload size={25} />
          <strong>{full ? `ครบ ${limit} รูปแล้ว` : "ลากไฟล์มาวาง หรือเลือกไฟล์"}</strong>
          <small>
            {pdf
              ? "PDF · ไม่เกิน 20 MB"
              : "JPEG, PNG หรือ WebP · ไม่เกิน 10 MB ต่อไฟล์"}
            {multiple ? " · เลือกได้หลายไฟล์" : ""}
            {max ? ` · ใช้ไป ${used}/${max}` : ""}
          </small>
        </span>
      </button>
      {limitNotice && <p className="field-error" role="status">{limitNotice}</p>}
      {files.length > 0 && (
        <div className="media-grid">
          {files.map((file) => (
            <div className="media-item" key={file.id}>
              <div className="media-thumb">
                {file.status === "ready" && (
                  <input type="hidden" name={name} value={file.id} />
                )}
                {file.preview ? (
                  // The preview is a private, pre-optimized derivative behind a signed redirect.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.preview} alt="" />
                ) : (
                  <FileText size={32} />
                )}
                <span className="media-file-name">{file.name}</span>
                {file.status === "uploading" && (
                  <>
                    <progress max={100} value={file.progress} />
                    <span className="sr-only">อัปโหลด {file.progress}%</span>
                  </>
                )}
                {file.status === "error" && (
                  <div className="media-error" role="alert">
                    {file.error}
                    <button
                      type="button"
                      onClick={() =>
                        file.file && void upload(file.file, file.id)
                      }
                      aria-label={`ลองอัปโหลด ${file.name} อีกครั้ง`}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`นำ ${file.name} ออก`}
                  onClick={() => remove(file)}
                >
                  <X size={14} />
                </button>
              </div>
              {!pdf && describe && (
                <div>
                  <label
                    className="media-alt-label"
                    htmlFor={`media-alt-${file.id}`}
                  >
                    ข้อความอธิบายรูปภาพ
                  </label>
                  <input
                    id={`media-alt-${file.id}`}
                    className="field media-alt-field"
                    type="text"
                    maxLength={500}
                    value={file.altText ?? ""}
                    disabled={file.status !== "ready"}
                    placeholder="เช่น ทีมช่างติดตั้งเครื่องปรับอากาศ"
                    onChange={(event) => {
                      onDirty?.();
                      const altText = event.target.value;
                      setFiles((current) =>
                        current.map((item) =>
                          item.id === file.id
                            ? { ...item, altText, altStatus: undefined }
                            : item,
                        ),
                      );
                    }}
                    onBlur={() => void saveAltText(file)}
                  />
                  <span
                    className={`media-alt-status ${file.altStatus === "error" ? "error" : ""}`}
                    aria-live="polite"
                  >
                    {altStatusText[file.altStatus ?? "idle"]}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="help">
        {pdf
          ? "ระบบตรวจว่าเป็นไฟล์ PDF จริงก่อนบันทึก"
          : "ระบบตรวจไฟล์ ลบข้อมูลแฝงในรูป หมุนรูปให้ตรง และย่อขนาดให้โหลดเร็วโดยอัตโนมัติ"}
      </p>
    </div>
  );
}

/** ยกเลิกไฟล์ที่อัปโหลดขึ้นเซิร์ฟเวอร์แล้วแต่ผู้ใช้กดยกเลิกระหว่างประมวลผล (ไม่สนผลลัพธ์) */
async function cancelServerUpload(mediaId: string) {
  await fetch(`/api/admin/media/uploads/${mediaId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    keepalive: true,
  }).catch(() => undefined);
}

const altStatusText: Record<NonNullable<UploadItem["altStatus"]> | "idle", string> = {
  saving: "กำลังบันทึก…",
  saved: "บันทึกแล้ว",
  error: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง",
  idle: "อธิบายสิ่งสำคัญในภาพสำหรับผู้ใช้โปรแกรมอ่านหน้าจอ",
};

/** สร้างส่วนหน้าจอ PreviewModal; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function PreviewModal({
  title,
  eyebrow,
  description,
  onClose,
}: Readonly<{
  title: string;
  eyebrow: string;
  description: string;
  onClose: () => void;
}>) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalAccessibility({
    containerRef: modalRef,
    backdropRef,
    initialFocusRef: closeRef,
    onClose,
  });
  return (
    <div ref={backdropRef} className="preview-modal">
      <dialog
        open
        ref={modalRef}
        className="preview-window"
        aria-modal="true"
        aria-labelledby="preview-title"
        tabIndex={-1}
      >
        <div className="preview-bar">
          <div className="cluster">
            <Eye size={17} />
            <strong id="preview-title">ตัวอย่างก่อนเผยแพร่</strong>
          </div>
          <button type="button"
            ref={closeRef}
            className="icon-btn"
            onClick={onClose}
            aria-label="ปิดตัวอย่าง"
          >
            <X size={19} />
          </button>
        </div>
        <section className="page-hero">
          <div className="container">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display">{title || "ชื่อเนื้อหา"}</h1>
            <p className="lead">
              {description || "รายละเอียดเนื้อหาจะแสดงในตำแหน่งนี้"}
            </p>
          </div>
        </section>
        <section className="section-sm">
          <div className="container detail-grid">
            <div className="media mint" style={{ minHeight: 340, borderRadius: 20 }}>
              <span className="sr-only">ตำแหน่งตัวอย่างรูปปก</span>
            </div>
            <div>
              <h2 className="heading">รายละเอียด</h2>
              <p className="lead">
                นี่คือตัวอย่างการแสดงผลบนเว็บไซต์
                ข้อมูลจริงจะอ้างอิงจากฟอร์มและสื่อที่อัปโหลด
              </p>
            </div>
          </div>
        </section>
      </dialog>
    </div>
  );
}

/** สร้างส่วนหน้าจอ EditorHeader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function EditorHeader({
  title,
  description,
  listHref,
}: Readonly<{
  title: string;
  description: string;
  listHref: string;
}>) {
  return (
    <div className="admin-head">
      <div>
        <p className="eyebrow admin-eyebrow">จัดการเนื้อหา</p>
        <h1 className="admin-title">{title}</h1>
        <p className="admin-subtitle">{description}</p>
      </div>
      <Link className="btn btn-outline" href={listHref}>
        <ArrowLeft size={16} aria-hidden="true" /> กลับหน้ารายการ
      </Link>
    </div>
  );
}

