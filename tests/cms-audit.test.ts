/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ cms-audit.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { CmsError } from "@/server/cms/errors";
import { cmsAuditErrorCode, cmsError } from "@/server/cms/http";

describe("CMS failure audit classification", () => {
  it("classifies validation and business-rule failures without exposing messages", () => {
    const validation = z.object({ title: z.string().min(1) }).safeParse({ title: "" });
    expect(validation.success).toBe(false);
    if (!validation.success) expect(cmsAuditErrorCode(validation.error)).toBe("VALIDATION_ERROR");
    expect(cmsAuditErrorCode(new CmsError("INVALID_TRANSITION", "รายละเอียดภายใน"))).toBe("INVALID_TRANSITION");
  });

  it("uses stable database and internal error codes", () => {
    const databaseError = new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
    expect(cmsAuditErrorCode(databaseError)).toBe("P2002");
    expect(cmsAuditErrorCode(new Error("secret detail"))).toBe("INTERNAL_ERROR");
  });
});

describe("CMS API error responses", () => {
  const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError("internal detail", { code, clientVersion: "test" });
  async function respond(error: unknown) {
    const response = cmsError(error, "request-under-test");
    return { status: response.status, body: await response.json() };
  }

  it("maps expected failures to safe messages and status codes", async () => {
    expect(await respond(new SyntaxError("Unexpected token"))).toEqual({ status: 400, body: { error: "ข้อมูลไม่ถูกต้อง" } });
    const invalid = z.object({ title: z.string().min(1) }).safeParse({ title: "" });
    if (!invalid.success) expect(await respond(invalid.error)).toMatchObject({ status: 400, body: { fields: { title: expect.any(Array) } } });
    expect(await respond(new CmsError("NOT_FOUND", "ไม่พบรายการ"))).toEqual({ status: 404, body: { error: "ไม่พบรายการ" } });
    expect((await respond(new CmsError("FORBIDDEN", "ไม่มีสิทธิ์"))).status).toBe(403);
    expect((await respond(new CmsError("CONFLICT", "ถูกแก้ไขแล้ว"))).status).toBe(409);
    expect(await respond(prismaError("P2025"))).toEqual({ status: 404, body: { error: "ไม่พบรายการ" } });
    expect((await respond(prismaError("P2002"))).status).toBe(409);
    expect((await respond(prismaError("P2003"))).status).toBe(409);
    expect((await respond(new Error("MEDIA_IN_USE"))).status).toBe(409);
    expect((await respond(new Error("INVALID_FILE_SIGNATURE"))).status).toBe(422);
  });

  it("hides unexpected failures behind a request id", async () => {
    for (const error of [new Error("database password leaked"), prismaError("P1001"), "not an error"]) {
      const { status, body } = await respond(error);
      expect(status).toBe(500);
      expect(body).toEqual({ error: "ไม่สามารถดำเนินการได้", requestId: "request-under-test" });
    }
  });
});
