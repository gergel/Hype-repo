import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getVideoDownloadUrl, getImageDownloadUrl } from "@/lib/api";

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

  try {
    const url = await getVideoDownloadUrl(videoId);
    window.location.href = url;
  } catch {
    window.open(mp4Url, "_blank");
  }
}

// Egy kép letöltése presigned URL-lel (CORS-mentes, mert navigálás, nem fetch)
export async function downloadImage(imageId: string) {
  try {
    const url = await getImageDownloadUrl(imageId);
    window.location.href = url;
  } catch {
    // semmi
  }
}

// Több kép letöltése egyenként, presigned URL-lel
export async function downloadImagesAll(imageIds: string[]) {
  for (const id of imageIds) {
    try {
      const url = await getImageDownloadUrl(id);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // kis szünet, hogy a böngésző ne torlódjon be
      await new Promise((r) => setTimeout(r, 800));
    } catch {
      // kihagyjuk a hibásat
    }
  }
}
