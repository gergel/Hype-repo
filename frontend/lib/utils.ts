import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

export async function forceDownload(url: string, filename: string) {
  // Mobil? (érintőképernyő + canShare fájlokra) → share-lap a galériába mentéshez
  const nav = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  const isMobileShare =
    typeof navigator !== "undefined" &&
    "canShare" in navigator &&
    typeof nav.share === "function";

  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();

    // Telefon: próbáljuk a natív megosztást (innen menthető a galériába)
    if (isMobileShare) {
      const file = new File([blob], filename, { type: blob.type || "video/mp4" });
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file], title: filename });
          return;
        } catch {
          // megszakította vagy nem ment → essünk a sima letöltésre
        }
      }
    }

    // Gép (és fallback): blobból kényszerített letöltés — azonnal a Letöltésekbe,
    // nem nyit új lapot, cross-origin is megbízhatóan működik
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    // végső esetben új lapon megnyitás
    window.open(url, "_blank");
  }
}
