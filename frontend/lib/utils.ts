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


// Mobil-e? (van-e Web Share API fájlokkal)
function isMobileShare(file?: File): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (!nav.canShare) return false;
  if (file) return nav.canShare({ files: [file] });
  return true;
}

// Egy kép letöltése: gépen azonnal letölt, telón megosztás (galériába mentés)
export async function downloadImage(url: string, filename: string) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };

  // Telón: megosztás-panel → Fotókba mentés
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file] });
      return;
    } catch {
      // ha a user megszakítja, nem csinálunk semmit
      return;
    }
  }

  // Gépen: azonnali letöltés blobból
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

// Több kép: telón egyenként megosztás (galériába), gépen egy ZIP
export async function downloadImagesAll(
  images: { url: string; title: string }[]
) {
  const mobile = isMobileShare();

  if (mobile) {
    // Telón: egyenként megosztás-panellel a Fotókba
    for (const img of images) {
      const ext = img.url.split("?")[0].split(".").pop() || "jpg";
      await downloadImage(img.url, `${img.title || "image"}.${ext}`);
    }
    return;
  }

  // Gépen: ZIP
  const zip = new JSZip();
  let index = 1;
  for (const img of images) {
    try {
      const res = await fetch(img.url, { mode: "cors" });
      const blob = await res.blob();
      const extFromUrl = img.url.split("?")[0].split(".").pop() || "";
      const ext = extFromUrl.length <= 4 ? extFromUrl : (blob.type.split("/")[1] || "jpg");
      const safeTitle = (img.title || `image-${index}`).replace(/[^\w.-]+/g, "_");
      zip.file(`${safeTitle}.${ext}`, blob);
    } catch {
      // kihagyjuk a nem letölthetőt
    }
    index++;
  }
  const content = await zip.generateAsync({ type: "blob" });
  const blobUrl = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = "photos.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
