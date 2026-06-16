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
  videos: Video[];
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  cover_image_url: string;
  status: string;
  has_password: boolean;
}

const BASE = `${process.env.NEXT_PUBLIC_API_URL || ""}/api`;

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
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

export function uploadVideo(
  projectId: string,
  file: File,
  title: string,
  onProgress?: (percent: number) => void
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${BASE}/admin/projects/${projectId}/videos?title=${encodeURIComponent(title)}`
    );
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("hype_admin_token")
        : null;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
      } else {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(fd);
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
  if (!res.ok) throw new Error("Cover upload failed");
  return res.json();
}

export async function replaceVideo(videoId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/admin/videos/${videoId}/replace`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
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
