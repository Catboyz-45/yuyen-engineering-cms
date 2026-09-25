import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";
import { isGoogleMapsEmbedUrl } from "@/lib/maps";
import { contentSecurityPolicy, storageOrigins } from "@/server/security/csp";

const storageConfigs = [
  { S3_ENDPOINT: "https://account.r2.cloudflarestorage.com", S3_REGION: "auto", S3_BUCKET: "media", S3_FORCE_PATH_STYLE: "false" },
  { S3_ENDPOINT: "http://localhost:9000", S3_REGION: "auto", S3_BUCKET: "media", S3_FORCE_PATH_STYLE: "true" },
  { S3_ENDPOINT: "https://sgp1.digitaloceanspaces.com", S3_REGION: "sgp1", S3_BUCKET: "media", S3_FORCE_PATH_STYLE: "false" },
  { S3_ENDPOINT: "https://s3.example.co.th:8443", S3_REGION: "auto", S3_BUCKET: "Media_Bucket", S3_FORCE_PATH_STYLE: "false" },
  { S3_REGION: "ap-southeast-1", S3_BUCKET: "media", S3_FORCE_PATH_STYLE: "false" },
  { S3_REGION: "ap-southeast-1", S3_BUCKET: "company.media", S3_FORCE_PATH_STYLE: "false" },
];

describe("content security policy", () => {
  it.each(storageConfigs)("allows the origin the S3 SDK signs for %o", async env => {
    const client = new S3Client({ region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: env.S3_FORCE_PATH_STYLE === "true", credentials: { accessKeyId: "test", secretAccessKey: "test" } });
    const signed = await getSignedUrl(client, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: "images/example.webp" }), { expiresIn: 60 });
    expect(storageOrigins(env)).toContain(new URL(signed).origin);
  });

  it("ignores unusable storage endpoints", () => {
    expect(storageOrigins({ S3_ENDPOINT: "not a url", S3_BUCKET: "media" })).toEqual([]);
    expect(storageOrigins({ S3_ENDPOINT: "javascript:alert(1)", S3_BUCKET: "media" })).toEqual([]);
    expect(storageOrigins({})).toEqual([]);
  });

  it("permits storage images, uploads and Google Maps frames without loosening other directives", () => {
    const policy = contentSecurityPolicy({ development: false, production: true, storageOrigins: ["https://media.example.com"] });
    const directives = Object.fromEntries(policy.split("; ").map(item => { const [name, ...values] = item.split(" "); return [name, values]; }));
    expect(directives["img-src"]).toContain("https://media.example.com");
    expect(directives["connect-src"]).toContain("https://media.example.com");
    expect(directives["frame-src"]).toEqual(["https://www.google.com"]);
    expect(directives["frame-ancestors"]).toEqual(["'none'"]);
    expect(directives["script-src"]).not.toContain("'unsafe-eval'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("accepts only HTTPS Google Maps embed links", () => {
    expect(isGoogleMapsEmbedUrl("https://www.google.com/maps/embed?pb=!1m18")).toBe(true);
    expect(isGoogleMapsEmbedUrl("http://www.google.com/maps/embed?pb=1")).toBe(false);
    expect(isGoogleMapsEmbedUrl("https://www.google.com.evil.test/maps/embed")).toBe(false);
    expect(isGoogleMapsEmbedUrl("https://evil.test/?https://www.google.com/maps/embed")).toBe(false);
    expect(isGoogleMapsEmbedUrl("javascript:alert(1)")).toBe(false);
    expect(isGoogleMapsEmbedUrl(null)).toBe(false);
  });
});
