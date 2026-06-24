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

const SHARE_LIMIT = 50 * 1024 * 1024; // iOS Web Share kb. 50 MB-os fájlkorlát

// Letöltés: mobilon 50 MB alatt megosztás (galériába), felette/gépen letöltés
// Letöltés: mobilon megosztás (galériába); ha nem megy (pl. túl nagy iOS-en), Fájlok
export async function downloadVideo(
  videoId: string,
  mp4Url: string,
  filename: string,
  sizeBytes: number
) {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };

  // Mobilon: megpróbáljuk a megosztást (galériába mentés).
  // Nem a méretre bízzuk a döntést, hanem ha az iOS elutasítja
  // (pl. túl nagy fájl), elkapjuk és átesünk a letöltésbe.
  if (isMobileDevice() && nav.share) {
    let shareFailed = false;
    try {
      const dlUrl = await getVideoDownloadUrl(videoId);
      const res = await fetch(dlUrl, { mode: "cors" });
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || "video/mp4" });

      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return; // sikeres megosztás
      } else {
        shareFailed = true; // a fájl nem osztható meg (pl. túl nagy)
      }
    } catch (err) {
      // A felhasználó megszakította? Akkor ne töltsünk le mást.
      const e = err as { name?: string };
      if (e && e.name === "AbortError") return;
      shareFailed = true;
    }

    // Ha a megosztás nem volt lehetséges → közvetlen letöltés (Fájlok)
    if (shareFailed) {
      try {
        const url = await getVideoDownloadUrl(videoId);
        window.location.href = url;
        return;
      } catch {
        window.open(mp4Url, "_blank");
        return;
      }
    }
    return;
  }

  // Gépen: blob letöltés (mappába)
  try {
    const dlUrl = await getVideoDownloadUrl(videoId);
    const res = await fetch(dlUrl, { mode: "cors" });
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    try {
      const url = await getVideoDownloadUrl(videoId);
      window.location.href = url;
    } catch {
      window.open(mp4Url, "_blank");
    }
  }
}
// Egy kép letöltése: telón galériába (Web Share), gépen közvetlen letöltés (gyors)
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

// Több kép: telón egyenként galériába (Web Share), gépen egy ZIP (gyors)
export async function downloadImagesAll(
  images: { id: string; title: string }[],
  onProgress?: (done: number, total: number) => void
) {
  if (isMobileDevice()) {
    let done = 0;
    for (const img of images) {
      await downloadImage(img.id, img.title);
      done++;
      if (onProgress) onProgress(done, images.length);
    }
    return;
  }

  // Gépen: ZIP — letöltés haladásjelzéssel, tömörítés nélkül (gyors)
  const zip = new JSZip();
  const total = images.length;
  let done = 0;

  const CONCURRENCY = 5;
  let cursor = 0;

  async function worker() {
    while (cursor < images.length) {
      const i = cursor++;
      const img = images[i];
      try {
        const url = await getImageDownloadUrl(img.id);
        const res = await fetch(url, { mode: "cors" });
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
        const safeTitle = (img.title || `image-${i + 1}`).replace(/[^\w.-]+/g, "_");
        zip.file(`${safeTitle}.${ext}`, blob, { compression: "STORE" });
      } catch {
        // egy hibás kép kimarad
      }
      done++;
      if (onProgress) onProgress(done, total);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, images.length) },
    () => worker()
  );
  await Promise.all(workers);

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
