"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  uploadCover,
  deleteCover,
  createFolder,
  updateFolder,
  deleteFolder,
  setVideoFolder,
  Folder,
} from "@/lib/api";
import {
  GripVertical,
  Upload,
  Trash2,
  Replace,
  Link2,
  Save,
  FolderPlus,
  Folder as FolderIcon,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import {
  getProjectDetail,
  updateProject,
  uploadVideo,
  replaceVideo,
  deleteVideo,
  reorderVideos,
  deleteProject,
  regenShare,
  Video,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatDuration, formatBytes } from "@/lib/utils";

export default function AdminProjectPage() {
  const id = useParams().id as string;
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getProjectDetail>> | null>(
    null
  );
  const [videos, setVideos] = useState<Video[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolder, setNewFolder] = useState("");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null); // null = root
  const [form, setForm] = useState({
    title: "",
    client_name: "",
    project_date: "",
    description: "",
    cover_image_url: "",
    slug: "",
    password: "",
    status: "live",
  });
  const [shareUrl, setShareUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<{ name: string; percent: number }[]>([]);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string>("");
  const coverRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string>("");

  async function refresh() {
    const d = await getProjectDetail(id);
    setData(d);
    setVideos(d.videos);
    setFolders((d as never)["folders"] || []);
    setForm((f) => ({
      ...f,
      title: d.title,
      client_name: d.client_name,
      project_date: (d as never)["project_date"] || "",
      description: d.description,
      cover_image_url: d.cover_image_url,
      slug: d.slug,
    }));
  }
  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      getProjectDetail(id).then((d) => {
        if (d.videos.some((v) => v.status === "processing")) setVideos(d.videos);
      });
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    const payload: Record<string, unknown> = { ...form };
    if (!form.password) delete payload.password;
    await updateProject(id, payload);
    setForm((f) => ({ ...f, password: "" }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refresh();
  }

  async function clearPassword() {
    await updateProject(id, { password: "" });
    setForm((f) => ({ ...f, password: "" }));
    refresh();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const targetFolder = currentFolder;
    for (const file of files) {
      const name = file.name.replace(/\.[^.]+$/, "");
      setUploads((u) => [...u, { name, percent: 0 }]);
      try {
        const result = await uploadVideo(id, file, name, (percent) => {
          setUploads((u) =>
            u.map((item) => (item.name === name ? { ...item, percent } : item))
          );
        });
        if (targetFolder && result && (result as { id?: string }).id) {
          await setVideoFolder((result as { id: string }).id, targetFolder);
        }
      } finally {
        setTimeout(() => {
          setUploads((u) => u.filter((item) => item.name !== name));
        }, 1500);
      }
    }
    refresh();
  }

  async function onCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { cover_image_url } = await uploadCover(id, file);
    setForm((f) => ({ ...f, cover_image_url }));
    refresh();
  }

  async function onDeleteCover() {
    await deleteCover(id);
    setForm((f) => ({ ...f, cover_image_url: "" }));
    refresh();
  }

  async function onReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && replaceId.current) {
      await replaceVideo(replaceId.current, file);
      refresh();
    }
  }

  async function onDrop(targetId: string) {
    const from = videos.findIndex((v) => v.id === dragId.current);
    const to = videos.findIndex((v) => v.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...videos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setVideos(next);
    await reorderVideos(id, next.map((v) => v.id));
  }

  async function makeShare() {
    const { url } = await regenShare(id);
    setShareUrl(url);
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  async function onDeleteProject() {
    const ok = window.confirm(
      "Are you sure you want to delete this project along with all of its videos? This cannot be undone."
    );
    if (!ok) return;
    await deleteProject(id);
    router.push("/admin");
  }

  // ---- Folders ----
  async function onCreateFolder() {
    const name = newFolder.trim();
    if (!name) return;
    await createFolder(id, name);
    setNewFolder("");
    refresh();
  }

  async function onRenameFolder(folderId: string) {
    const current = folders.find((f) => f.id === folderId);
    const name = window.prompt("New folder name:", current?.name || "");
    if (name === null) return;
    await updateFolder(folderId, { name });
    refresh();
  }

  async function onDeleteFolder(folderId: string) {
    const ok = window.confirm(
      "Delete this folder? The videos inside will remain, they'll just be removed from the folder."
    );
    if (!ok) return;
    await deleteFolder(folderId);
    if (currentFolder === folderId) setCurrentFolder(null);
    refresh();
  }

  async function onRemoveFromFolder(videoId: string) {
    await setVideoFolder(videoId, null);
    refresh();
  }

  if (!data) return null;
  const portalUrl = `/p/${form.slug}`;

  const visibleVideos = videos.filter((v) =>
    currentFolder ? v.folder_id === currentFolder : !v.folder_id
  );
  const openFolder = folders.find((f) => f.id === currentFolder) || null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <a href="/admin" className="font-mono text-xs uppercase tracking-eyebrow text-mist">
        ← All projects
      </a>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Settings */}
        <section className="rounded-2xl border border-ink-line bg-ink-card p-6">
          <h2 className="font-display text-xl text-bone">Project details</h2>
          <div className="mt-5 space-y-3">
            {[
              ["title", "Project title"],
              ["client_name", "Client name"],
              ["project_date", "Date (e.g. 2026-06-17)"],
              ["slug", "Portal slug"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={(form as never)[key]}
                onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
              />
            ))}

            <div>
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                  Cover image
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => coverRef.current?.click()}
                    className="text-xs text-ember hover:underline"
                  >
                    Upload
                  </button>
                  {form.cover_image_url && (
                    <button
                      type="button"
                      onClick={onDeleteCover}
                      className="text-xs text-mist hover:text-ember hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {form.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.cover_image_url}
                  alt="Cover"
                  className="mt-2 h-32 w-full rounded-2xl border border-ink-line object-cover"
                />
              )}
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onCoverUpload}
              />
            </div>

            <div>
              <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="mt-1.5 w-full rounded-2xl border border-ink-line bg-ink px-4 py-3 text-bone outline-none focus:border-ember/60"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                  Password {data.has_password ? "(set)" : "(none)"}
                </label>
                {data.has_password && (
                  <button
                    type="button"
                    onClick={clearPassword}
                    className="text-xs text-ember hover:underline"
                  >
                    Reset password
                  </button>
                )}
              </div>
              <input
                type="password"
                value={form.password}
                placeholder={data.has_password ? "New password (leave empty to keep)" : "Set password"}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1.5 w-full rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={save}>
              <Save className="h-4 w-4" />
              {saved ? "Saved" : "Save changes"}
            </Button>
            <Button variant="ghost" asChild>
              <a href={portalUrl} target="_blank">
                View portal
              </a>
            </Button>
            <Button variant="ghost" onClick={makeShare}>
              <Link2 className="h-4 w-4" />
              Share link
            </Button>
            <button
              onClick={onDeleteProject}
              className="ml-auto flex items-center gap-2 rounded-full border border-ember/40 px-4 py-2 text-sm text-ember transition hover:bg-ember/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete project
            </button>
          </div>
          {shareUrl && (
            <p className="mt-3 break-all rounded-xl border border-ink-line bg-ink px-3 py-2 font-mono text-xs text-mist">
              Copied: {shareUrl}
            </p>
          )}

          {/* New folder */}
          <div className="mt-8 border-t border-ink-line pt-6">
            <h3 className="font-display text-lg text-bone">New folder</h3>
            <div className="mt-3 flex items-center gap-2">
              <input
                placeholder="Folder name"
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onCreateFolder()}
                className="flex-1 rounded-full border border-ink-line bg-ink px-4 py-2 text-bone outline-none focus:border-ember/60"
              />
              <Button variant="primary" size="sm" onClick={onCreateFolder}>
                <FolderPlus className="h-4 w-4" />
                Create
              </Button>
            </div>
          </div>
        </section>

        {/* Files / Folders (Drive-like) */}
        <section className="rounded-2xl border border-ink-line bg-ink-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {currentFolder && (
                <button
                  onClick={() => setCurrentFolder(null)}
                  title="Back"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist transition hover:bg-white/[0.05] hover:text-bone"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <h2 className="truncate font-display text-xl text-bone">
                {openFolder ? openFolder.name : "Content"}
              </h2>
            </div>
            <Button variant="ember" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              multiple
              hidden
              onChange={onUpload}
            />
            <input ref={replaceRef} type="file" accept="video/*" hidden onChange={onReplace} />
          </div>

          <p className="mt-2 text-xs text-mist">
            {currentFolder
              ? "Uploaded videos will go into this folder."
              : "Open a folder, or upload videos here without a folder."}
          </p>

          {uploads.length > 0 && (
            <div className="mt-4 space-y-2">
              {uploads.map((u) => (
                <div
                  key={u.name}
                  className="rounded-xl border border-ink-line bg-ink px-3 py-2.5"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="truncate text-sm text-bone">{u.name}</span>
                    <span className="font-mono text-[11px] text-mist">
                      {u.percent < 100 ? `${u.percent}%` : "Processing…"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-line">
                    <div
                      className="h-full rounded-full bg-ember transition-all duration-200"
                      style={{ width: `${u.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Folders (root only) */}
          {!currentFolder && folders.length > 0 && (
            <ul className="mt-4 space-y-2">
              {folders.map((f) => {
                const count = videos.filter((v) => v.folder_id === f.id).length;
                return (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink px-3 py-2.5"
                  >
                    <button
                      onClick={() => setCurrentFolder(f.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <FolderIcon className="h-5 w-5 shrink-0 text-ember" />
                      <span className="truncate text-sm text-bone">{f.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-mist">
                        {count} {count === 1 ? "video" : "videos"}
                      </span>
                    </button>
                    <button
                      title="Rename"
                      onClick={() => onRenameFolder(f.id)}
                      className="text-mist transition hover:text-bone"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      title="Delete folder"
                      onClick={() => onDeleteFolder(f.id)}
                      className="text-mist transition hover:text-ember"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Videos in current view */}
          <ul className="mt-2 space-y-2">
            {visibleVideos.map((v) => (
              <li
                key={v.id}
                draggable
                onDragStart={() => (dragId.current = v.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(v.id)}
                className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink px-3 py-2.5"
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-mist" />
                <div className="h-9 w-16 shrink-0 overflow-hidden rounded bg-ink-soft">
                  {v.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone">{v.title}</p>
                  <p className="font-mono text-[11px] text-mist">
                    {v.status === "ready"
                      ? `${v.resolution_label} · ${formatDuration(v.duration_seconds)} · ${formatBytes(v.size_bytes)}`
                      : v.status === "processing"
                      ? "Processing…"
                      : "Failed"}
                  </p>
                </div>
                {currentFolder && (
                  <button
                    title="Remove from folder"
                    onClick={() => onRemoveFromFolder(v.id)}
                    className="text-mist transition hover:text-bone"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <button
                  title="Replace"
                  onClick={() => {
                    replaceId.current = v.id;
                    replaceRef.current?.click();
                  }}
                  className="text-mist transition hover:text-bone"
                >
                  <Replace className="h-4 w-4" />
                </button>
                <button
                  title="Delete"
                  onClick={async () => {
                    await deleteVideo(v.id);
                    refresh();
                  }}
                  className="text-mist transition hover:text-ember"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {visibleVideos.length === 0 && (
              <li className="py-8 text-center text-sm text-mist">
                {currentFolder
                  ? "Empty folder. Upload videos here."
                  : "No videos without a folder. Open a folder or upload here."}
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
      />
    </div>
  );
}
