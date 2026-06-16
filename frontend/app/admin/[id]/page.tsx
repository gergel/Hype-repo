"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { uploadCover } from "@/lib/api";
import {
  GripVertical,
  Upload,
  Trash2,
  Replace,
  Link2,
  Save,
} from "lucide-react";
import {
  getProjectDetail,
  updateProject,
  uploadVideo,
  replaceVideo,
  deleteVideo,
  reorderVideos,
  regenShare,
  Video,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatDuration, formatBytes } from "@/lib/utils";

export default function AdminProjectPage() {
  const id = useParams().id as string;
  const [data, setData] = useState<Awaited<ReturnType<typeof getProjectDetail>> | null>(
    null
  );
  const [videos, setVideos] = useState<Video[]>([]);
  const [form, setForm] = useState({
    title: "",
    client_name: "",
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
    setForm((f) => ({
      ...f,
      title: d.title,
      client_name: d.client_name,
      description: d.description,
      cover_image_url: d.cover_image_url,
      slug: d.slug,
    }));
  }
  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      // poll while any video is still processing
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

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const name = file.name.replace(/\.[^.]+$/, "");
      setUploads((u) => [...u, { name, percent: 0 }]);
      try {
        await uploadVideo(id, file, name, (percent) => {
          setUploads((u) =>
            u.map((item) => (item.name === name ? { ...item, percent } : item))
          );
        });
      } finally {
        // feltöltés kész → vegyük le a listáról kis késleltetéssel
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

  if (!data) return null;
  const portalUrl = `/p/${form.slug}`;

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
              ["cover_image_url", "Cover image URL"],
              ["slug", "Portal slug"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={(form as never)[key]}
                onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
              />
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                className="mt-1 text-xs text-ember hover:underline"
              >
                Vagy tölts fel képet
              </button>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onCoverUpload}
              />
            ))}
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
            <Field
              label={`Password ${data.has_password ? "(set — leave blank to keep)" : "(none)"}`}
              type="password"
              value={form.password}
              placeholder="Set or change password"
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            />
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
          </div>
          {shareUrl && (
            <p className="mt-3 break-all rounded-xl border border-ink-line bg-ink px-3 py-2 font-mono text-xs text-mist">
              Copied: {shareUrl}
            </p>
          )}
        </section>

        {/* Videos */}
        <section className="rounded-2xl border border-ink-line bg-ink-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-bone">Videos</h2>
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

          <p className="mt-2 text-xs text-mist">Drag the handle to reorder.</p>

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
                      {u.percent < 100 ? `${u.percent}%` : "Feldolgozás…"}
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

          <ul className="mt-4 space-y-2">
            {videos.map((v) => (
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
            {videos.length === 0 && (
              <li className="py-8 text-center text-sm text-mist">
                No videos yet. Upload to start processing.
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
