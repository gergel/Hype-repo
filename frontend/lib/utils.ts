import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import JSZip from "jszip";
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

// Tényleg mobil eszköz-e (Web Share fájlokkal csak ott releváns)
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isTouchMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  return isTouchMobile && typeof nav.canShare === "function";
}

const SHARE_LIMIT = 300 * 1024 * 1024; // 300 MB alatt: blob + mobil megosztás

// Letöltés: kis fájl blob (mobil megosztással), nagy fájl közvetlen R2.
export async function downloadVideo(
  videoId: string,
  mp4Url: string,
  filename: string,
  sizeBytes: number
) {
  const isSmall = sizeBytes > 0 && sizeBytes < SHARE_LIMIT;

  if (isSmall) {
    try {
      const res = await fetch(mp4Url, { mode: "cors" });
      const blob = await res.blob();

      if (isMobileDevice()) {
        const file = new File([blob], filename, { type: blob.type || "video/mp4" });
        const nav = navigator as Navigator & {
          canShare?: (data: { files: File[] }) => boolean;
          share?: (data: { files: File[]; title?: string }) => Promise<void>;
        };
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

// Egy kép letöltése: telón galériába (Web Share), gépen közvetlen letöltés
export async function downloadImage(imageId: string, title?: string) {
  const url = await getImageDownloadUrl(imageId);

  // Gépen: nincs blob-fetch — a presigned URL attachment-ként jön,
  // a böngésző azonnal letölti. Gyors, nincs hosszú "Preparing".
  if (!isMobileDevice()) {
    const a = document.createElement("a");
    a.href = url;
    a.download = title || "image";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  // Mobilon: a galériába mentéshez kell a fájl tartalma (Web Share)
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
  const filename = `${title || "image"}.${ext}`;

  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file] });
      return;
    } catch {
      return;
    }
  }

  // Tartalék mobilon, ha a megosztás nem elérhető: blob letöltés
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

  // Gépen (vagy ha a megosztás nem elérhető): letöltés blobból
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

// Több kép: telón egyenként galériába (Web Share), gépen egy ZIP
// Több kép: telón egyenként galériába (Web Share), gépen egy ZIP (gyors)
export async function downloadImagesAll(
  images: { id: string; title: string }[]
) {
  if (isMobileDevice()) {
    for (const img of images) {
      await downloadImage(img.id, img.title);
    }
    return;
  }

  // Gépen: ZIP — párhuzamos letöltés, tömörítés nélkül (gyors)
  const zip = new JSZip();

  // 1) Minden kép letöltése PÁRHUZAMOSAN
  const blobs = await Promise.all(
    images.map(async (img, i) => {
      try {
        const url = await getImageDownloadUrl(img.id);
        const res = await fetch(url, { mode: "cors" });
        const blob = await res.blob();
        return { blob, title: img.title, index: i + 1 };
      } catch {
        return null;
      }
    })
  );

  // 2) Hozzáadás a ZIP-hez tömörítés nélkül (STORE)
  for (const item of blobs) {
    if (!item) continue;
    const ext = (item.blob.type.split("/")[1] || "jpg").split("+")[0];
    const safeTitle = (item.title || `image-${item.index}`).replace(/[^\w.-]+/g, "_");
    zip.file(`${safeTitle}.${ext}`, item.blob, { compression: "STORE" });
  }

  // 3) ZIP generálás tömörítés nélkül
  const content = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const blobUrl = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = "photos.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
