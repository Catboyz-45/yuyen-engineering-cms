/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ public-cache.test ยืนยันว่าการแก้ไขใน CMS ทำให้แคชหน้าเว็บหมดอายุทันที ไม่เสิร์ฟฉบับเก่าต่อ
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { invalidatePublicContent } from "@/server/services/public-cache";

describe("public cache invalidation", () => {
  beforeEach(() => revalidateTag.mockReset());

  it("expires cached public data immediately so unpublished or trashed content is never served again", () => {
    invalidatePublicContent("news");
    expect(revalidateTag).toHaveBeenCalledWith("public-content", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("news", { expire: 0 });
    expect(revalidateTag).not.toHaveBeenCalledWith(expect.anything(), "max");
  });
});
