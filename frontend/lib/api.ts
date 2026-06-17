export interface Video {
  id: string;
  title: string;
  mp4_url: string;
  hls_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  width: number;
  height: number;
  resolution_label: string;
  aspect_ratio_label: string;
  size_bytes: number;
  status: string;
  sort_order: number;
}

export interface PublicProject {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  description: string;
  cover_image_url: string;
  project_date: string;
  videos: Video[];
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  cover_image_url: string;
  status: string;
  project_date: string;
  has_password: boolean;
}

const BASE = `${process.env.NEXT_PUBLIC_API_URL || ""}/api`;

// Lejárt vagy érvénytelen munkamenet kezelése:
// töröljük a tokent, és ha admin oldalon vagyunk, visszadobunk a bejelentkezéshez.
function handleUnauthorized() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("hype_admin_token");
    if (window.location.pathname.startsWith("/admin")) {
      window.location.href = "/admin";
    }
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// ---- Public ----
export async function getPublicProject(slug: string, token?: string) {
  const q = token ? `?authorization=${encodeURIComponent(token)}` : "";
  return req<{ locked: boolean; project?: PublicProject; title?: string; cover_image_url?: string }>(
    `/public/projects/${slug}${q}`
  );
}

export async function unlockProject(slug: string, password: string) {
  return req<{ token: string }>(`/public/projects/${slug}/unlock`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function getByShare(token: string) {
  return req<{ locked: boolean; project: PublicProject }>(`/public/share/${token}`);
}

// ---- Auth + admin (token in localStorage) ----
function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("hype_admin_token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function adminLogin(email: string, password: string) {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${BASE}/auth/login`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  localStorage.setItem("hype_admin_token", data.access_token);
  return data;
}

export async function listProjects() {
  return req<ProjectSummary[]>(`/admin/projects`, { headers: authHeaders() });
}

export async function createProject(data: Record<string, unknown>) {
  return req<ProjectSummary>(`/admin/projects`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: string, data: Record<string, unknown>) {
  return req(`/admin/projects/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string) {
  return req(`/admin/projects/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function getProjectDetail(id: string) {
  return req<PublicProject & { share_token: string; has_password: boolean }>(
    `/admin/projects/${id}`,
    { headers: authHeaders() }
  );
}

export async function regenShare(id: string) {
  return req<{ url: string; token: string }>(`/admin/projects/${id}/share`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function reorderVideos(projectId: string, ordered_ids: string[]) {
  return req(`/admin/projects/${projectId}/videos/reorder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ordered_ids }),
  });
}

// ---- Multipart videó feltöltés (közvetlenül R2-be, nagy fájlokhoz) ----
export async function uploadVideo(
  projectId: string,
  file: File,
  title: string,
  onProgress?: (percent: number) => void
): Promise<unknown> {
  const PART_SIZE = 100 * 1024 * 1024; // 100 MB darabok
  const headers = { "Content-Type": "application/json", ...authHeaders() };

  // 1) Indítás
  const initRes = await fetch(`${BASE}/admin/projects/${projectId}/videos/multipart/init`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || "video/mp4",
      title,
    }),
  });
  if (initRes.status === 401) {
    handleUnauthorized();
    throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  }
  if (!initRes.ok) throw new Error("Feltöltés indítása sikertelen");
  const { video_id, upload_id, key } = await initRes.json();

  try {
    const totalParts = Math.ceil(file.size / PART_SIZE);
    const parts: { PartNumber: number; ETag: string }[] = [];
    let uploadedBytes = 0;

    // 2) Darabok feltöltése egyenként
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const blob = file.slice(start, end);

      // aláírt URL a darabhoz
      const signRes = await fetch(`${BASE}/admin/videos/multipart/sign-part`, {
        method: "POST",
        headers,
        body: JSON.stringify({ upload_id, key, part_number: partNumber }),
      });
      if (!signRes.ok) throw new Error("Darab aláírása sikertelen");
      const { url } = await signRes.json();

      // a darab feltöltése közvetlenül R2-be, haladással
      const etag = await uploadPart(url, blob, (partLoaded) => {
        if (onProgress) {
          const pct = Math.round(((uploadedBytes + partLoaded) / file.size) * 100);
          onProgress(Math.min(pct, 99)); // 100% majd a complete után
        }
      });
      uploadedBytes += blob.size;
      parts.push({ PartNumber: partNumber, ETag: etag });
    }

    // 3) Lezárás → elindul a feldolgozás
    const completeRes = await fetch(`${BASE}/admin/videos/multipart/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ upload_id, key, video_id, parts }),
    });
    if (!completeRes.ok) throw new Error("Feltöltés lezárása sikertelen");
    if (onProgress) onProgress(100);
    return completeRes.json();
  } catch (err) {
    // hiba esetén megszakítjuk és takarítunk
    await fetch(`${BASE}/admin/videos/multipart/abort`, {
      method: "POST",
      headers,
      body: JSON.stringify({ upload_id, key, video_id }),
    }).catch(() => {});
    throw err;
  }
}

// Egy darab feltöltése aláírt URL-re, ETag kiolvasással + haladással
function uploadPart(
  url: string,
  blob: Blob,
  onPartProgress?: (loaded: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onPartProgress) onPartProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(new Error("Hiányzó ETag — ellenőrizd az R2 CORS ExposeHeaders beállítást"));
          return;
        }
        resolve(etag);
      } else {
        reject(new Error(`Darab feltöltése sikertelen (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Darab feltöltése sikertelen"));
    xhr.send(blob);
  });
}

export async function uploadCover(projectId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/admin/projects/${projectId}/cover`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  }
  if (!res.ok) throw new Error("Cover upload failed");
  return res.json();
}

export async function deleteCover(projectId: string) {
  return req<{ cover_image_url: string }>(`/admin/projects/${projectId}/cover`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function replaceVideo(videoId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/admin/videos/${videoId}/replace`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("A munkamenet lejárt. Jelentkezz be újra.");
  }
  if (!res.ok) throw new Error("Replace failed");
  return res.json();
}

export async function deleteVideo(videoId: string) {
  return req(`/admin/videos/${videoId}`, { method: "DELETE", headers: authHeaders() });
}

export async function syncNotion() {
  return req<{ synced: number }>(`/admin/notion/sync`, {
    method: "POST",
    headers: authHeaders(),
  });
}
