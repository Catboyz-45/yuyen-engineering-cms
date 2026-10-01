/**
 * หน้าที่ของไฟล์นี้: ทดสอบโหลด (load test) ว่าเว็บรับผู้ใช้พร้อมกันได้แค่ไหน โดยเพิ่มจำนวนผู้ใช้เป็นช่วงๆ แล้ววัดเวลาตอบและ error
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ใช้กับเครื่องตัวเองหรือ staging เท่านั้น ห้ามยิงใส่ production จริงหรือเว็บของคนอื่น
 * ผู้ใช้จำลองแต่ละคนขอหน้าต่อเนื่องโดยไม่หยุดพัก จึงหนักกว่าคนจริงหลายเท่า ตัวเลขที่ได้คือ "คำขอพร้อมกัน" ไม่ใช่จำนวนผู้เข้าชมต่อวัน
 *
 * ตัวอย่าง: LOAD_TEST_STAGES=10,25,50 LOAD_TEST_STAGE_SECONDS=20 npx tsx scripts/load-test.ts
 * หลังบ้าน: LOAD_TEST_SCENARIO=cms LOAD_TEST_SESSION_TOKENS=<token1>,<token2> (session ของบัญชีทดสอบเท่านั้น)
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";

const env = z.object({
  LOAD_TEST_BASE_URL: z.string().url().default("http://localhost:3000"),
  LOAD_TEST_SCENARIO: z.enum(["public", "cms"]).default("public"),
  LOAD_TEST_STAGES: z.string().regex(/^\d+(,\d+)*$/).default("10,25,50,100"),
  LOAD_TEST_STAGE_SECONDS: z.coerce.number().int().min(5).max(600).default(20),
  LOAD_TEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
  LOAD_TEST_P95_LIMIT_MS: z.coerce.number().int().min(50).default(1000),
  LOAD_TEST_ERROR_LIMIT: z.coerce.number().min(0).max(1).default(0.01),
  LOAD_TEST_SESSION_TOKENS: z.string().optional(),
  LOAD_TEST_COOKIE_NAME: z.string().regex(/^[\w-]+$/).default("__Host-yuyen_session"),
  // ยิงไปเครื่องอื่นได้เฉพาะเมื่อตั้งค่านี้ เพื่อยืนยันว่าเป็น staging ที่ได้รับอนุญาต ไม่ใช่ production
  LOAD_TEST_ALLOW_REMOTE: z.literal("staging-only").optional(),
  LOAD_TEST_OUTPUT: z.string().optional(),
}).parse(process.env);

const base = new URL(env.LOAD_TEST_BASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !env.LOAD_TEST_ALLOW_REMOTE) {
  throw new Error("Refusing to load test a non-local host. Set LOAD_TEST_ALLOW_REMOTE=staging-only only for an approved staging server, never production.");
}
const sessionTokens = env.LOAD_TEST_SESSION_TOKENS?.split(",").filter(Boolean) ?? [];
if (env.LOAD_TEST_SCENARIO === "cms" && !sessionTokens.length) throw new Error("The cms scenario needs LOAD_TEST_SESSION_TOKENS from test accounts");

type Sample = { ms: number; status: number; path: string };

async function request(path: string, token?: string): Promise<Sample> {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, base), {
      headers: token ? { cookie: `${env.LOAD_TEST_COOKIE_NAME}=${token}` } : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(env.LOAD_TEST_TIMEOUT_MS),
    });
    await response.arrayBuffer();
    return { ms: performance.now() - started, status: response.status, path };
  } catch {
    return { ms: performance.now() - started, status: 0, path };
  }
}

/** ดึงลิงก์จริงจากหน้ารายการ เพื่อให้ยิงหน้ารายละเอียดและรูปที่มีอยู่จริง ไม่ใช่ชื่อที่เดาเอง */
async function discoverPublicPaths() {
  const paths = new Set(["/", "/about", "/services", "/products", "/projects", "/news", "/contact", "/sitemap.xml"]);
  for (const collection of ["/services", "/products", "/projects", "/news"]) {
    const html = await (await fetch(new URL(collection, base))).text();
    for (const match of html.matchAll(new RegExp(`href="(${collection}/[^"/?#]+)"`, "g"))) paths.add(match[1]);
  }
  const products = await (await fetch(new URL("/products", base))).text();
  const word = products.match(/<h3[^>]*>([A-Za-z]+)/)?.[1];
  if (word) paths.add(`/products?q=${encodeURIComponent(word)}`);
  const brand = products.match(/name="brand"[^>]*value="([a-z0-9-]+)"/)?.[1] ?? products.match(/brand=([a-z0-9-]+)/)?.[1];
  if (brand) paths.add(`/products?brand=${brand}`);
  const home = await (await fetch(new URL("/", base))).text();
  // รูปที่ Next.js ย่อขนาดให้ (/_next/image) กินแรงเครื่องมากที่สุด จึงรวมไว้ด้วย
  for (const match of home.matchAll(/(\/_next\/image\?[^"\s]+)/g)) paths.add(match[1].replaceAll("&amp;", "&"));
  return [...paths];
}

function cmsPaths() {
  return ["/admin", "/admin/products", "/admin/services", "/admin/news", "/admin/audit", "/api/admin/content/products?query=&status=ALL&sort=updated-desc&page=1&pageSize=10"];
}

function percentile(sorted: number[], fraction: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

async function runStage(users: number, paths: string[]) {
  const samples: Sample[] = [];
  const endAt = Date.now() + env.LOAD_TEST_STAGE_SECONDS * 1000;
  await Promise.all(Array.from({ length: users }, async (_, user) => {
    let step = user;
    while (Date.now() < endAt) {
      const path = paths[(step * 7 + user) % paths.length];
      const token = sessionTokens.length ? sessionTokens[user % sessionTokens.length] : undefined;
      samples.push(await request(path, token));
      step += 1;
    }
  }));
  const times = samples.map(sample => sample.ms).sort((a, b) => a - b);
  // หลังบ้านที่ไม่มี session จะ redirect (3xx) ไปหน้า login ซึ่งถือว่าผิดสำหรับการทดสอบนี้
  const failed = samples.filter(sample => sample.status === 0 || sample.status >= 400 || (env.LOAD_TEST_SCENARIO === "cms" && sample.status >= 300));
  const statuses: Record<string, number> = {};
  for (const sample of samples) statuses[sample.status || "timeout/network"] = (statuses[sample.status || "timeout/network"] ?? 0) + 1;
  const slowest = Object.entries(samples.reduce<Record<string, number[]>>((byPath, sample) => ((byPath[sample.path] ??= []).push(sample.ms), byPath), {}))
    .map(([path, values]) => ({ path: path.length > 80 ? `${path.slice(0, 77)}...` : path, p95: Math.round(percentile(values.sort((a, b) => a - b), 0.95)) }))
    .sort((a, b) => b.p95 - a.p95).slice(0, 3);
  const result = {
    users,
    requests: samples.length,
    requestsPerSecond: Math.round(samples.length / env.LOAD_TEST_STAGE_SECONDS),
    p50: Math.round(percentile(times, 0.5)),
    p95: Math.round(percentile(times, 0.95)),
    p99: Math.round(percentile(times, 0.99)),
    max: Math.round(times.at(-1) ?? 0),
    errorRate: samples.length ? failed.length / samples.length : 1,
    statuses,
    slowest,
  };
  return { ...result, passed: result.p95 <= env.LOAD_TEST_P95_LIMIT_MS && result.errorRate <= env.LOAD_TEST_ERROR_LIMIT };
}

async function main() {
  const paths = env.LOAD_TEST_SCENARIO === "public" ? await discoverPublicPaths() : cmsPaths();
  // อุ่นเครื่องก่อนวัด: คำขอแรกของแต่ละหน้าอาจช้าเพราะยังไม่มี cache
  for (const path of paths) await request(path, sessionTokens[0]);
  console.log(`Load test ${env.LOAD_TEST_SCENARIO} → ${base.origin} (${paths.length} paths, ${env.LOAD_TEST_STAGE_SECONDS}s per stage, pass = p95 ≤ ${env.LOAD_TEST_P95_LIMIT_MS}ms and errors ≤ ${env.LOAD_TEST_ERROR_LIMIT * 100}%)`);
  const stages = [];
  for (const users of env.LOAD_TEST_STAGES.split(",").map(Number)) {
    const stage = await runStage(users, paths);
    stages.push(stage);
    console.log(`${String(users).padStart(4)} users: ${stage.requestsPerSecond} req/s, p50 ${stage.p50}ms, p95 ${stage.p95}ms, p99 ${stage.p99}ms, errors ${(stage.errorRate * 100).toFixed(2)}% ${stage.passed ? "PASS" : "FAIL"} · slowest ${stage.slowest.map(item => `${item.path} ${item.p95}ms`).join(", ")}`);
  }
  if (env.LOAD_TEST_OUTPUT) writeFileSync(env.LOAD_TEST_OUTPUT, JSON.stringify({ scenario: env.LOAD_TEST_SCENARIO, baseUrl: base.origin, stageSeconds: env.LOAD_TEST_STAGE_SECONDS, p95LimitMs: env.LOAD_TEST_P95_LIMIT_MS, errorLimit: env.LOAD_TEST_ERROR_LIMIT, paths, stages }, null, 2));
  process.exitCode = stages.every(stage => stage.passed) ? 0 : 1;
}

void main();
