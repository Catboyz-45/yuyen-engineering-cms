import "server-only";
import { revalidateTag } from "next/cache";
import type { ContentKind } from "@/server/cms/schemas";

// Expire immediately rather than stale-while-revalidate ("max"): an unpublish or trash must hide the
// content on the very next request, e.g. when a customer name was published by mistake.
const immediately = { expire: 0 };

export function invalidatePublicContent(kind?: ContentKind) {
  revalidateTag("public-content", immediately);
  if (kind) revalidateTag(kind, immediately);
}
