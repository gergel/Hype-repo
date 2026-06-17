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
  const SHARE_LIMIT = 150 * 1024 * 1024; // 150 MB alatt próbáljuk a mobil megosztást

  // Nézzük meg a fájl méretét egy gyors HEAD kéréssel (ha lehet)
  let size = 0;
  try {
    const head = await fetch(url, { method: "HEAD" });
    size = parseInt(head.headers.get("content-length") || "0", 10);
  } catch {
    size = 0; // ha nem megy, feltételezzük, hogy nagy → azonnali letöltés
  }

  const canTryShare =
    size > 0 &&
    size < SHARE_LIMIT &&
    typeof navigator !== "undefined" &&
    "canShare" in navigator;

  // Kis fájl mobilon: próbáljuk a natív megosztást (galériába menthető)
  if (canTryShare) {
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || "video/mp4" });
      const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string }) => Promise<void>;
      };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: filename });
        return;
      }
      // ha a megosztás nem elérhető, essünk át az azonnali letöltésre
    } catch {
      // megszakítás vagy hiba → azonnali letöltés
    }
  }

  // Nagy fájl (vagy ha a megosztás nem ment): AZONNALI közvetlen letöltés,
  // a böngésző streameli, nem tölti memóriába
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

    // Asztali (vagy ha a megosztás nem elérhető): sima letöltés
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    // ha valami nem megy, essünk vissza az új lapon megnyitásra
    window.open(url, "_blank");
  }
}
