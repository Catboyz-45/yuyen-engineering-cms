/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบตัวเชื่อม S3 ยืนยันการเซ็น URL และคำสั่งที่ส่งไปยัง storage โดยไม่ต่อเครือข่ายจริง
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteObjectsCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const env = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/server/config/env", () => ({ getServerEnv: () => env.value }));

import { S3ObjectStorage, storage } from "@/server/storage/s3";

const baseEnv = {
  S3_BUCKET: "yuyen-unit",
  S3_ACCESS_KEY_ID: "unit-test-access-key",
  S3_SECRET_ACCESS_KEY: "unit-test-secret-key",
  S3_REGION: "us-east-1",
  S3_ENDPOINT: "http://minio.internal:9000",
  S3_PUBLIC_ENDPOINT: "https://files.example.test",
  S3_FORCE_PATH_STYLE: "true",
  S3_CONNECTION_TIMEOUT_MS: 5_000,
  S3_REQUEST_TIMEOUT_MS: 30_000,
};

describe("S3 object storage adapter", () => {
  beforeEach(() => { env.value = { ...baseEnv }; });
  afterEach(() => vi.restoreAllMocks());

  it("refuses to start without a bucket and credentials", () => {
    env.value = { ...baseEnv, S3_BUCKET: undefined };
    expect(() => new S3ObjectStorage()).toThrow("OBJECT_STORAGE_NOT_CONFIGURED");
  });

  it("signs browser URLs for the public endpoint, not the internal one", async () => {
    const adapter = new S3ObjectStorage();
    const upload = new URL(await adapter.signPut("media/a.webp", "image/webp", 1024, 300));
    expect(upload.origin).toBe("https://files.example.test");
    expect(upload.pathname).toBe("/yuyen-unit/media/a.webp");
    expect(upload.searchParams.get("X-Amz-Expires")).toBe("300");
    const download = new URL(await adapter.signGet("media/catalog.pdf", 120, "แคตตาล็อก.pdf"));
    expect(download.searchParams.get("response-content-disposition")).toBe(`attachment; filename*=UTF-8''${encodeURIComponent("แคตตาล็อก.pdf")}`);
    expect(new URL(await adapter.signGet("media/a.webp", 120)).searchParams.has("response-content-disposition")).toBe(false);
  });

  it("signs with the storage endpoint when no public endpoint is set", async () => {
    env.value = { ...baseEnv, S3_PUBLIC_ENDPOINT: undefined };
    expect(new URL(await new S3ObjectStorage().signGet("media/a.webp", 60)).origin).toBe("http://minio.internal:9000");
  });

  it("sends head, get, put, delete and health commands for the configured bucket", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: 42, ContentType: "image/webp" };
      if (command instanceof HeadBucketCommand || command instanceof PutObjectCommand || command instanceof DeleteObjectsCommand) return {};
      return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };
    });
    const adapter = new S3ObjectStorage();
    await adapter.checkHealth();
    expect(await adapter.head("media/a.webp")).toEqual({ size: 42, contentType: "image/webp" });
    expect(await adapter.get("media/a.webp")).toEqual(new Uint8Array([1, 2, 3]));
    await adapter.put("media/b.webp", new Uint8Array([9]), "image/webp");
    await adapter.deleteMany([]);
    await adapter.deleteMany(["media/a.webp", "media/b.webp"]);
    const commands = send.mock.calls.map(([command]) => command as unknown as { input: Record<string, unknown> });
    expect(commands).toHaveLength(5);
    expect(commands.every(command => command.input.Bucket === "yuyen-unit")).toBe(true);
    expect(commands[3].input).toMatchObject({ Key: "media/b.webp", ContentType: "image/webp", CacheControl: "private, max-age=31536000, immutable" });
    expect(commands[4].input).toMatchObject({ Delete: { Objects: [{ Key: "media/a.webp" }, { Key: "media/b.webp" }], Quiet: true } });
  });

  it("reports a missing object size as zero and a missing body as an error", async () => {
    vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => (command instanceof HeadObjectCommand ? {} : { Body: undefined }));
    const adapter = new S3ObjectStorage();
    expect(await adapter.head("media/empty")).toEqual({ size: 0, contentType: undefined });
    await expect(adapter.get("media/empty")).rejects.toThrow("STORAGE_BODY_UNAVAILABLE");
  });

  it("reuses one adapter for the whole process", () => {
    expect(storage()).toBe(storage());
  });
});
