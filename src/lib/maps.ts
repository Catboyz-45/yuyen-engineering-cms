// The Content-Security-Policy only allows Google Maps embeds in frames, so other URLs would render blank.
export function isGoogleMapsEmbedUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try { const url = new URL(value); return url.protocol === "https:" && url.host === "www.google.com" && url.pathname.startsWith("/maps/embed"); } catch { return false; }
}
