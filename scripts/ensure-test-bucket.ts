/**
 * หน้าที่ของไฟล์นี้: สร้าง bucket ทดสอบใน object storage ที่แยกไว้สำหรับ CI/E2E ถ้ายังไม่มี โดยใช้ SDK ที่โปรเจกต์ติดตั้งอยู่แล้ว
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

const env = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().regex(/(test|e2e|ci|sandbox)/i, "Refusing to create a bucket whose name does not mark it as test-only"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
}).parse(process.env);

const client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

async function main() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    process.stdout.write(`Bucket ${env.S3_BUCKET} already exists\n`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    process.stdout.write(`Created bucket ${env.S3_BUCKET}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Unable to create test bucket"}\n`);
  process.exitCode = 1;
});
