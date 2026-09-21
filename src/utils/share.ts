/**
 * Utility to generate public shareable room URLs and handle reliable clipboard copying.
 * In AI Studio, window.location.origin can be an internal dev container hostname (ais-dev-...)
 * or iframe origin which is inaccessible to external users.
 * This helper resolves to the public app URL whenever available.
 */

export function getPublicBaseUrl(): string {
  // If Vite public base or custom public URL is configured
  const envPublicUrl = (import.meta as any).env?.VITE_PUBLIC_APP_URL;
  if (envPublicUrl && envPublicUrl.startsWith("http")) {
    return envPublicUrl.replace(/\/+$/, "");
  }

  const origin = window.location.origin;

  // AI Studio preview rewrite: ais-dev-* can be replaced by ais-pre-* for external preview access
  if (origin.includes("ais-dev-")) {
    return origin.replace("ais-dev-", "ais-pre-");
  }

  return origin;
}

export function getShareableRoomUrl(roomId: string): string {
  const base = getPublicBaseUrl();
  return `${base}/?room=${encodeURIComponent(roomId)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // fallback
  }

  // Fallback using textarea
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Failed to copy text:", err);
    return false;
  }
}
