import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getVideoDownloadUrl } from "@/lib/api";

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

const SHARE_LIMIT = 300 * 1024 * 1024; // 300 MB alatt: blob + mobil megosztás

// Letöltés: kis fájl blob (mobil megosztással), nagy fájl közvetlen R2.
// sizeBytes a videó ismert mérete (size_bytes) — nem kell HEAD kérés.
export async function downloadVideo(
  videoId: string,
  mp4Url: string,
  filename: string,
  sizeBytes: number
) {
  const nav = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  const canShareFiles =
    typeof navigator !== "undefined" &&
    "canShare" in navigator &&
    typeof nav.share === "function";

  // Kis fájl: blob letöltés, mobilon megosztás-lap (galériába mentés)
  const isSmall = sizeBytes > 0 && sizeBytes < SHARE_LIMIT;

  if (isSmall) {
    try {
      const res = await fetch(mp4Url, { mode: "cors" });
      const blob = await res.blob();

      if (canShareFiles) {
        const file = new File([blob], filename, { type: blob.type || "video/mp4" });
        if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
          try {
            await nav.share({ files: [file], title: filename });
            return;
          } catch {
            // megszakítva → sima letöltés
          }
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      return;
    } catch {
      // ha a blob nem ment, essünk át a közvetlen letöltésre
    }
  }

  // Nagy fájl (vagy fallback): közvetlen R2 letöltés aláírt URL-lel
  try {
    const url = await getVideoDownloadUrl(videoId);
    window.location.href = url;
  } catch {
    window.open(mp4Url, "_blank");
  }
}


import JSZip from "jszip";

// Egy kép letöltése (telón galériába a Web Share-rel, ha lehet)
export async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type });

    // Mobil: Web Share API → galériába mentés
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[] }) => Promise<void>;
    };
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      await nav.share({ files: [file] });
      return;
    }

    // Egyébként sima letöltés
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch {
    // ha a fetch elhasal (pl. CORS), nyissuk meg új lapon
    window.open(url, "_blank");
  }
}

// Több kép letöltése egy ZIP-be csomagolva
export async function downloadImagesZip(
  images: { url: string; title: string }[],
  zipName = "images.zip"
) {
  const zip = new JSZip();
  let index = 1;
  for (const img of images) {
    try {
      const res = await fetch(img.url);
      const blob = await res.blob();
      // kiterjesztés az URL-ből vagy a MIME típusból
      const extFromUrl = img.url.split("?")[0].split(".").pop() || "";
      const ext =
        extFromUrl.length <= 4
          ? extFromUrl
          : (blob.type.split("/")[1] || "jpg");
      const safeTitle = (img.title || `image-${index}`).replace(/[^\w.-]+/g, "_");
      zip.file(`${safeTitle}.${ext}`, blob);
    } catch {
      // ha egy kép nem tölthető, kihagyjuk
    }
    index++;
  }
  const content = await zip.generateAsync({ type: "blob" });
  const blobUrl = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
