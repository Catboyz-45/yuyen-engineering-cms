/** An HTTPS URL, or a path on this site ("/products"); rejects javascript:, data:, protocol-relative "//host" and backslash tricks. */
export function isSafeHref(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\") && !/[\u0000-\u001f\s]/.test(value);
  return isHttpsUrl(value);
}

export function isHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
