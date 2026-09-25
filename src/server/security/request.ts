import "server-only";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthEnv } from "@/server/env";
import { keyedHash } from "./crypto";

export function requestContext(request: NextRequest) {
  return { requestId: request.headers.get("x-request-id") || randomUUID(), ipHash: clientIpHash(request) ?? keyedHash("unknown"), userAgent: request.headers.get("user-agent")?.slice(0, 500) || null };
}
export function clientIpHash(request: NextRequest): string | null {
  const ip = clientIp(request.headers, getAuthEnv().TRUSTED_PROXY_COUNT); return ip ? keyedHash(ip) : null;
}
// Each trusted reverse proxy appends the address it received the request from, so only the entry
// written by the outermost trusted proxy is reliable; anything to its left is client-controlled.
export function clientIp(headers: Headers, trustedProxyCount: number): string | null {
  if (trustedProxyCount < 1) return null;
  const forwarded = headers.get("x-forwarded-for")?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
  if (forwarded.length) return forwarded[Math.max(0, forwarded.length - trustedProxyCount)] ?? null;
  return headers.get("x-real-ip")?.trim() || null;
}
export function assertSameOrigin(request: NextRequest): boolean {
  return isSameOrigin(request.headers.get("origin"), getAuthEnv().APP_URL);
}
export function isSameOrigin(origin: string | null, appUrl: string): boolean {
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(appUrl).origin; } catch { return false; }
}
