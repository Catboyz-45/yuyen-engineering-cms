/** An HTTPS URL, or a path on this site ("/products"); rejects javascript:, data:, protocol-relative "//host" and backslash tricks. */
export function isSafeHref(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\") && !/[\s\u0000-\u0008\u000e-\u001f]/.test(value);
  return isHttpsUrl(value);
}

export function isHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
