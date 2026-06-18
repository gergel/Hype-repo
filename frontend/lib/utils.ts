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

// Egy kép letöltése: a presigned URL-t fetcheljük (blob), telón galériába (Web Share), gépen letöltés
export async function downloadImage(imageId: string, title?: string) {
  const url = await getImageDownloadUrl(imageId);
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
    const filename = `${title || "image"}.${ext}`;
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
  } catch {
    // ha a fetch elhasal (CORS), fallback: presigned URL-re navigálás (Fájlokba ment)
    window.location.href = url;
  }
}

// Több kép: telón egyenként galériába (Web Share), gépen egy ZIP
export async function downloadImagesAll(
  images: { id: string; title: string }[]
) {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  const mobile = !!nav.canShare;

  if (mobile) {
    // Telón: egyenként galériába a Web Share-rel
    for (const img of images) {
      await downloadImage(img.id, img.title);
    }
    return;
  }

  // Gépen: ZIP a presigned URL-ekből
  const zip = new JSZip();
  let index = 1;
  for (const img of images) {
    try {
      const url = await getImageDownloadUrl(img.id);
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
      const safeTitle = (img.title || `image-${index}`).replace(/[^\w.-]+/g, "_");
      zip.file(`${safeTitle}.${ext}`, blob);
    } catch {
      // kihagyjuk a hibásat
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
