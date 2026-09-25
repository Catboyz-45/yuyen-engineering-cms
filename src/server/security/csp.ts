export const GOOGLE_MAPS_EMBED_ORIGIN = "https://www.google.com";

type StorageEnv = { S3_ENDPOINT?: string; S3_BUCKET?: string; S3_REGION?: string; S3_FORCE_PATH_STYLE?: string };

// Buckets that are valid DNS labels are addressed as <bucket>.<host> by the AWS SDK unless
// path-style is forced; other names fall back to <host>/<bucket>.
const virtualHostBucket = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/** Origins that signed object-storage URLs can point to, mirroring the AWS SDK's addressing rules. */
export function storageOrigins(env: StorageEnv): string[] {
  const bucket = env.S3_BUCKET?.trim(); const pathStyle = env.S3_FORCE_PATH_STYLE === "true"; const origins = new Set<string>();
  if (env.S3_ENDPOINT?.trim()) {
    let endpoint: URL; try { endpoint = new URL(env.S3_ENDPOINT); } catch { return []; }
    if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") return [];
    origins.add(endpoint.origin);
    if (bucket && !pathStyle && virtualHostBucket.test(bucket)) origins.add(`${endpoint.protocol}//${bucket}.${endpoint.host}`);
  } else if (bucket) {
    const region = env.S3_REGION && env.S3_REGION !== "auto" && /^[a-z0-9-]+$/.test(env.S3_REGION) ? env.S3_REGION : "us-east-1";
    origins.add(`https://s3.${region}.amazonaws.com`);
    if (!pathStyle && virtualHostBucket.test(bucket)) origins.add(`https://${bucket}.s3.${region}.amazonaws.com`);
  }
  return [...origins];
}

export function contentSecurityPolicy(options: { development: boolean; production: boolean; storageOrigins: string[] }) {
  const storage = options.storageOrigins.map(origin => ` ${origin}`).join("");
  return [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
    `img-src 'self' data: blob:${storage}`, "font-src 'self' data:", "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${options.development ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self'${storage}`, `media-src 'self' blob:${storage}`, `frame-src ${GOOGLE_MAPS_EMBED_ORIGIN}`,
    ...(options.production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

let runtimePolicy: string | undefined;
/** Built from runtime environment variables so the storage origin does not have to be known at image build time. */
export function runtimeContentSecurityPolicy() {
  runtimePolicy ??= contentSecurityPolicy({ development: process.env.NODE_ENV === "development", production: process.env.NODE_ENV === "production", storageOrigins: storageOrigins({
    S3_ENDPOINT: process.env.S3_ENDPOINT, S3_BUCKET: process.env.S3_BUCKET, S3_REGION: process.env.S3_REGION, S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  }) });
  return runtimePolicy;
}
