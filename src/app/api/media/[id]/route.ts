/**
 * หน้าที่ของไฟล์นี้: API /api/media/[id] ส่งต่อไปยัง signed URL ของไฟล์ เฉพาะไฟล์ที่เนื้อหาเผยแพร่อยู่ใช้ หรือผู้ดูแลที่ยืนยันตัวตนแล้ว
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ไฟล์ของเนื้อหาฉบับร่างหรือในถังขยะจะตอบว่าไม่พบ (404) สำหรับผู้เยี่ยมชม
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentSession } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { db } from "@/server/db";
import { publicReference } from "@/server/media/access";
import { storage } from "@/server/storage/s3";

const querySchema = z.object({ width: z.coerce.number().int().min(1).max(3000).optional(), format: z.enum(["webp", "avif"]).optional(), download: z.enum(["0", "1"]).optional() });
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams)); if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const session = await currentSession(); const authorizedAdmin = Boolean(session?.twoFactorAt && session.admin.isActive && !session.admin.deletedAt);
  const media = await db.media.findFirst({ where: { id: (await params).id, status: "READY", deletedAt: null, ...(authorizedAdmin ? {} : publicReference()) }, include: { variants: { select: { format: true, width: true, objectKey: true } } } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let objectKey = media.objectKey;
  if (media.kind === "IMAGE" && media.variants.length) {
    const format = (parsed.data.format ?? "webp").toUpperCase(); const width = parsed.data.width ?? 1280;
    const candidates = media.variants.filter(item => item.format === format).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    objectKey = (candidates.find(item => (item.width ?? 0) >= width) ?? candidates.at(-1) ?? media).objectKey;
  }
  try {
    const signedSeconds = getServerEnv().MEDIA_SIGNED_URL_SECONDS;
    const url = await storage().signGet(objectKey, signedSeconds, parsed.data.download === "1" ? (media.originalName ?? "download") : undefined);
    // Visitors' browsers may reuse the redirect for half the signature lifetime so it never points at an expired URL;
    // administrators can see unpublished media, so their responses are never stored.
    const cacheControl = authorizedAdmin ? "private, no-store" : `private, max-age=${Math.min(300, Math.floor(signedSeconds / 2))}`;
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": cacheControl, "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch { return NextResponse.json({ error: "Media unavailable" }, { status: 503 }); }
}
