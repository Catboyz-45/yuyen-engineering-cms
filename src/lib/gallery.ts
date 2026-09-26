/**
 * หน้าที่ของไฟล์นี้: รวมรูปปกกับรูปในแกลเลอรีเป็นลำดับเดียวสำหรับแสดงผล
 */
type MediaId = { id: string };

/** จำนวนรูปในแกลเลอรีสูงสุด (ไม่นับรูปปก) ใช้ทั้งหน้าจอหลังบ้านและการตรวจฝั่งเซิร์ฟเวอร์ */
export const GALLERY_LIMITS = { service: 12, product: 12, project: 50, company: 12 } as const;

/** รูปปกขึ้นก่อน ตามด้วยรูปในแกลเลอรีตามลำดับที่ตั้งไว้ รูปที่ใช้ซ้ำแสดงครั้งเดียว */
export function galleryImages<T extends MediaId>(cover: T | null | undefined, gallery: ReadonlyArray<{ media: T }>): T[] {
  const images = [cover, ...gallery.map(entry => entry.media)].filter((media): media is T => Boolean(media));
  return images.filter((media, position) => images.findIndex(other => other.id === media.id) === position);
}
