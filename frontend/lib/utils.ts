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

const SHARE_LIMIT = 100 * 1024 * 1024; // iOS Web Share kb. 100 MB-os fájlkorlát (galériába mentés)

// Letöltés: mobilon 100 MB alatt megosztás (galériába), felette natív letöltő (Fájlok).
// Gépen mindig a böngésző natív letöltője (streamel, nincs blob-várakozás).
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

  // ---- Mobil ----
  if (isMobileDevice() && nav.share) {
    try {
      const dlUrl = await getVideoDownloadUrl(videoId);

      // Méret: a megadott size, ha 0, akkor gyors HEAD kérés (Content-Length).
      let size = sizeBytes;
      if (!size || size <= 0) {
        try {
          const head = await fetch(dlUrl, { method: "HEAD", mode: "cors" });
          const len = head.headers.get("content-length");
          size = len ? parseInt(len, 10) : 0;
        } catch {
          size = 0;
        }
      }

      // 100 MB felett (vagy ismeretlen, de nagy): NATÍV letöltő, NEM blobozunk.
      const knownSmall = size > 0 && size < SHARE_LIMIT;
      if (!knownSmall) {
        window.location.href = dlUrl;
        return;
      }

      // 100 MB alatt: letöltjük blobként és megosztjuk (galériába mentés).
      const res = await fetch(dlUrl, { mode: "cors" });
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || "video/mp4" });

      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
      // ha mégsem osztható meg → natív letöltő
      window.location.href = dlUrl;
      return;
    } catch (err) {
      const e = err as { name?: string };
      if (e && e.name === "AbortError") return; // felhasználó zárta be a megosztást
      try {
        const url = await getVideoDownloadUrl(videoId);
        window.location.href = url;
        return;
      } catch {
        window.open(mp4Url, "_blank");
        return;
      }
    }
  }

  // ---- Gép ----
  // A böngésző natív letöltője (streamel, azonnal indul, nincs blob-várakozás).
  try {
    const dlUrl = await getVideoDownloadUrl(videoId);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.open(mp4Url, "_blank");
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
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean
) {
  if (isMobileDevice()) {
    let done = 0;
    for (const img of images) {
      if (shouldCancel && shouldCancel()) return;
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
      if (shouldCancel && shouldCancel()) return;
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

  if (shouldCancel && shouldCancel()) return;

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


// Egy mappa teljes tartalma (videók + képek) EGY ZIP-be.
// Gépen: minden a ZIP-be (STORE, tömörítés nélkül). Nagy videóknál lassú/memóriaigényes lehet.
// Mobilon: a ZIP-et nem erőltetjük — egyenként töltjük (galériába), mert a mobil böngésző
// nem bír nagy ZIP-et memóriában összerakni.
export async function downloadFolderZip(
  folderName: string,
  videos: { id: string; title: string }[],
  images: { id: string; title: string }[],
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean
) {
  const total = videos.length + images.length;
  let done = 0;
  const safeFolder = (folderName || "mappa").replace(/[^\w.-]+/g, "_");

  // ---- Mobil: egyenként (galériába), nem ZIP ----
  if (isMobileDevice()) {
    for (const v of videos) {
      if (shouldCancel && shouldCancel()) return;
      await downloadVideo(v.id, "", `${v.title}.mp4`, 0);
      done++;
      if (onProgress) onProgress(done, total);
    }
    for (const img of images) {
      if (shouldCancel && shouldCancel()) return;
      await downloadImage(img.id, img.title);
      done++;
      if (onProgress) onProgress(done, total);
    }
    return;
  }

  // ---- Gép: minden egy ZIP-be ----
  const zip = new JSZip();

  // Képek (párhuzamosan)
  const IMG_CONCURRENCY = 5;
  let imgCursor = 0;
  async function imgWorker() {
    while (imgCursor < images.length) {
      if (shouldCancel && shouldCancel()) return;
      const i = imgCursor++;
      const img = images[i];
      try {
        const url = await getImageDownloadUrl(img.id);
        const res = await fetch(url, { mode: "cors" });
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
        const safe = (img.title || `kep-${i + 1}`).replace(/[^\w.-]+/g, "_");
        zip.file(`${safe}.${ext}`, blob, { compression: "STORE" });
      } catch {
        // hibás kép kimarad
      }
      done++;
      if (onProgress) onProgress(done, total);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(IMG_CONCURRENCY, images.length) }, () => imgWorker())
  );

  // Videók (egyesével, mert nagyok — párhuzamosan elfogyna a memória)
  for (let i = 0; i < videos.length; i++) {
    if (shouldCancel && shouldCancel()) return;
    const v = videos[i];
    try {
      const url = await getVideoDownloadUrl(v.id);
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const safe = (v.title || `video-${i + 1}`).replace(/[^\w.-]+/g, "_");
      zip.file(`${safe}.mp4`, blob, { compression: "STORE" });
    } catch {
      // hibás videó kimarad
    }
    done++;
    if (onProgress) onProgress(done, total);
  }

  if (shouldCancel && shouldCancel()) return;

  const content = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const blobUrl = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `${safeFolder}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
