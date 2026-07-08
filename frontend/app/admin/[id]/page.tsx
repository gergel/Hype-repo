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
  uploadImage,
  deleteImage,
  setImageFolder,
  renameVideo,
  Folder,
  Image as ImageType,
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
  const [images, setImages] = useState<ImageType[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    client_name: "",
    project_date: "",
    description: "",
    cover_image_url: "",
    slug: "",
    password: "",
    status: "live",
    brand: "hype",
    expires_at: "",
    payment_mode: "contact",
  });
  const [shareUrl, setShareUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; percent: number }[]>([]);
  const [batch, setBatch] = useState<{
    total: number;
    done: number;
    startedAt: number;
  } | null>(null);
  const [videoBatch, setVideoBatch] = useState<{
    total: number;
    done: number;
    startedAt: number;
  } | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string>("");
  const dragId = useRef<string>("");
  const cancelUpload = useRef(false);
  const abortController = useRef<AbortController | null>(null);

  const [prompt, setPrompt] = useState<{
    title: string;
    value: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  async function refresh() {
    const d = await getProjectDetail(id);
    setData(d);
    setVideos(d.videos);
    setImages((d as never)["images"] || []);
    setFolders((d as never)["folders"] || []);
    setForm((f) => ({
      ...f,
      title: d.title,
      client_name: d.client_name,
      project_date: (d as never)["project_date"] || "",
      description: d.description,
      cover_image_url: d.cover_image_url,
      slug: d.slug,
      brand: (d as never)["brand"] || "hype",
      expires_at: String((d as any)["expires_at"] || "").slice(0, 10),
      payment_mode: (d as never)["payment_mode"] || "contact",
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


  async function onChangeExpiry(value: string) {
    setForm((f) => ({ ...f, expires_at: value }));
    // value = "YYYY-MM-DD" → ISO a backendnek (a nap végét vesszük)
    const iso = value ? new Date(value + "T23:59:59").toISOString() : null;
    await updateProject(id, { expires_at: iso });
    refresh();
  }

function daysLeft(): number | null {
    if (!form.expires_at) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(form.expires_at + "T00:00:00");
    exp.setHours(0, 0, 0, 0);
    return Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  async function clearPassword() {
    await updateProject(id, { password: "" });
    setForm((f) => ({ ...f, password: "" }));
    refresh();
  }

  function cancelUploadNow() {
    cancelUpload.current = true;
    abortController.current?.abort();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (e.target) e.target.value = ""; // reset, hogy ugyanazt újra lehessen választani
    await handleFiles(files, currentFolder);
  }

  // Mappa ráhúzása: a webkitGetAsEntry-vel összegyűjtjük a mappa ÖSSZES fájlját
  // (az almappákból is), és egyetlen, a mappa nevével létrehozott mappába tesszük.
  // Nincs almappa — minden lapításra kerül egy szintre.
  async function onDropFiles(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);

    const items = Array.from(e.dataTransfer.items || []);
    const entries = items
      .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
      .filter(Boolean) as FileSystemEntry[];

    // Ha nincs entry-támogatás, sima fájllistaként kezeljük (mappa nélkül)
    if (entries.length === 0) {
      const files = Array.from(e.dataTransfer.files || []);
      await handleFiles(files, currentFolder);
      return;
    }

    // Egy mappa ÖSSZES fájljának összegyűjtése (rekurzívan, lapítva)
    async function collectAllFiles(entry: FileSystemEntry): Promise<File[]> {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject)
        );
        return [file];
      }
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const all: File[] = [];
      let batch: FileSystemEntry[] = [];
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject)
        );
        for (const child of batch) {
          const childFiles = await collectAllFiles(child);
          all.push(...childFiles);
        }
      } while (batch.length > 0);
      return all;
    }

    // A gyökérbe ejtett külön fájlokat is összegyűjtjük (mappa nélkül)
    const looseFiles: File[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) {
        // Behúzott mappa → létrejön egy mappa a nevével, minden fájlja oda kerül
        const folderName = entry.name;
        const existing = folders.find((f) => f.name === folderName);
        let folderId: string;
        if (existing) {
          folderId = existing.id;
        } else {
          const created = await createFolder(id, folderName);
          folderId = created.id;
        }
        const allFiles = await collectAllFiles(entry);
        await handleFiles(allFiles, folderId);
      } else {
        // Külön fájl (nem mappa) → az aktuális nézet mappájába
        const file = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject)
        );
        looseFiles.push(file);
      }
    }

    if (looseFiles.length > 0) {
      await handleFiles(looseFiles, currentFolder);
    }

    refresh();
  }

  function isJunkFile(f: File): boolean {
    const n = f.name;
    if (n === ".DS_Store" || n === "Thumbs.db" || n === "desktop.ini") return true;
    if (n.startsWith("._")) return true; // macOS resource fork
    if (n.startsWith(".")) return true;  // egyéb rejtett fájlok
    return false;
  }

  async function handleFiles(rawFiles: File[], targetFolder: string | null) {
    const files = rawFiles.filter((f) => !isJunkFile(f));
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const otherFiles = files.filter((f) => !f.type.startsWith("image/"));

    // --- Képek: kötegelt feltöltés (egyszerre 2) összevont folyamatjelzővel ---
    if (imageFiles.length > 0) {
      const CONCURRENCY = 2;
      let done = 0;
      const startedAt = Date.now();
      cancelUpload.current = false;
      abortController.current = new AbortController();
      setBatch({ total: imageFiles.length, done: 0, startedAt });

      // A frissen feltöltött képeket pufferbe gyűjtjük, és időnként
      // egyszerre tesszük a rácsba — így nem renderel minden képnél.
      let buffer: ImageType[] = [];
      const flushTimer = setInterval(() => {
        if (buffer.length > 0) {
          const toAdd = buffer;
          buffer = [];
          setImages((prev) => [...prev, ...toAdd]);
        }
      }, 1500);

      let cursor = 0;
      async function worker() {
        while (cursor < imageFiles.length) {
          if (cancelUpload.current) return; // leállítás: a hátralévőket kihagyjuk
          const myIndex = cursor++;
          const file = imageFiles[myIndex];
          try {
            const created = await uploadImage(
              id,
              file,
              targetFolder,
              abortController.current?.signal
            );
            if (created && (created as ImageType).id) {
              buffer.push(created as ImageType);
            }
          } catch {
            // megszakítás vagy hibás kép — ne állítsa meg a többit
          }
          done++;
          if (done % 5 === 0 || done === imageFiles.length) {
            setBatch((b) => (b ? { ...b, done } : b));
          }
        }
      }
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, imageFiles.length) },
        () => worker()
      );
      await Promise.all(workers);

      // utolsó puffer kiürítése
      clearInterval(flushTimer);
      if (buffer.length > 0) {
        setImages((prev) => [...prev, ...buffer]);
      }
      setBatch(null);
      abortController.current = null;
    }

    // --- Videók: egyesével, összesítő számlálóval + egyenkénti %-kal ---
    const videoStartedAt = Date.now();
    if (otherFiles.length > 0) {
      setVideoBatch({ total: otherFiles.length, done: 0, startedAt: videoStartedAt });
    }
    for (let vi = 0; vi < otherFiles.length; vi++) {
      const file = otherFiles[vi];
      const name = file.name.replace(/\.[^.]+$/, "");
      setVideoBatch({ total: otherFiles.length, done: vi, startedAt: videoStartedAt });
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
      // Videó után frissítünk (kevés van belőle)
      refresh();
    }
    setVideoBatch(null);
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

function makeShare() {
    const url = `${window.location.origin}/p/${form.slug}`;
    setShareUrl(url);
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  function onDeleteProject() {
    setConfirmDialog({
      message:
        "Biztosan törlöd ezt a projektet az összes videójával és képével együtt? Ez nem vonható vissza.",
      onConfirm: async () => {
        await deleteProject(id);
        router.push("/admin");
      },
    });
  }

  function onCreateFolder() {
    setPrompt({
      title: "Új mappa neve",
      value: "",
      onConfirm: async (name) => {
        if (!name.trim()) return;
        await createFolder(id, name.trim());
        refresh();
      },
    });
  }

  function onRenameFolder(folderId: string) {
    const current = folders.find((f) => f.id === folderId);
    setPrompt({
      title: "Új mappa neve",
      value: current?.name || "",
      onConfirm: async (name) => {
        if (!name.trim()) return;
        await updateFolder(folderId, { name: name.trim() });
        refresh();
      },
    });
  }

  function onRenameVideo(videoId: string) {
    const current = videos.find((v) => v.id === videoId);
    setPrompt({
      title: "Videó átnevezése",
      value: current?.title || "",
      onConfirm: async (name) => {
        if (!name.trim()) return;
        await renameVideo(videoId, name.trim());
        refresh();
      },
    });
  }

  function onDeleteFolder(folderId: string) {
    setConfirmDialog({
      message: "Törlöd ezt a mappát a benne lévő összes videóval és képpel együtt? Ez nem vonható vissza.",
      onConfirm: async () => {
        await deleteFolder(folderId);
        if (currentFolder === folderId) setCurrentFolder(null);
        refresh();
      },
    });
  }

  function onDeleteVideo(videoId: string) {
    setConfirmDialog({
      message: "Törlöd ezt a videót? Ez nem vonható vissza.",
      onConfirm: async () => {
        await deleteVideo(videoId);
        refresh();
      },
    });
  }

  function onDeleteImage(imageId: string) {
    setConfirmDialog({
      message: "Törlöd ezt a képet? Ez nem vonható vissza.",
      onConfirm: async () => {
        await deleteImage(imageId);
        refresh();
      },
    });
  }

  async function onRemoveFromFolder(videoId: string) {
    await setVideoFolder(videoId, null);
    refresh();
  }

  async function onRemoveImageFromFolder(imageId: string) {
    await setImageFolder(imageId, null);
    refresh();
  }

  function toggleVideo(videoId: string) {
    setSelectedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }

  function toggleImage(imageId: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedVideos(new Set());
    setSelectedImages(new Set());
  }

  // Összes látható kijelölése (az aktuális nézetben lévő videók + képek)
  function selectAllVisible() {
    setSelectedVideos(new Set(visibleVideos.map((v) => v.id)));
    setSelectedImages(new Set(visibleImages.map((i) => i.id)));
  }

  // Shift+klikk tartomány-kijelöléshez az utolsó kattintott index
  const lastVideoIndex = useRef<number | null>(null);
  const lastImageIndex = useRef<number | null>(null);

  // Videó kijelölése kattintással; shift esetén tartomány az előzőtől
  function clickVideo(index: number, shift: boolean) {
    if (shift && lastVideoIndex.current !== null) {
      const start = Math.min(lastVideoIndex.current, index);
      const end = Math.max(lastVideoIndex.current, index);
      setSelectedVideos((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          const v = visibleVideos[i];
          if (v) next.add(v.id);
        }
        return next;
      });
    } else {
      toggleVideo(visibleVideos[index].id);
    }
    lastVideoIndex.current = index;
  }

  // Kép kijelölése kattintással; shift esetén tartomány az előzőtől
  function clickImage(index: number, shift: boolean) {
    if (shift && lastImageIndex.current !== null) {
      const start = Math.min(lastImageIndex.current, index);
      const end = Math.max(lastImageIndex.current, index);
      setSelectedImages((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          const img = visibleImages[i];
          if (img) next.add(img.id);
        }
        return next;
      });
    } else {
      toggleImage(visibleImages[index].id);
    }
    lastImageIndex.current = index;
  }

  // Kijelöltek áthelyezése egy mappába (vagy ki a mappából, ha null)
  async function moveSelectedToFolder(folderId: string | null) {
    const vIds = Array.from(selectedVideos);
    const iIds = Array.from(selectedImages);
    for (const vid of vIds) {
      await setVideoFolder(vid, folderId).catch(() => {});
    }
    for (const iid of iIds) {
      await setImageFolder(iid, folderId).catch(() => {});
    }
    clearSelection();
    setMoveMenuOpen(false);
    refresh();
  }

  function onDeleteSelected() {
    const vIds = Array.from(selectedVideos);
    const iIds = Array.from(selectedImages);
    const total = vIds.length + iIds.length;
    if (total === 0) return;
    setConfirmDialog({
      message: `Törlöd a kijelölt ${total} elemet? Ez nem vonható vissza.`,
      onConfirm: async () => {
        for (const vid of vIds) {
          await deleteVideo(vid).catch(() => {});
        }
        for (const iid of iIds) {
          await deleteImage(iid).catch(() => {});
        }
        clearSelection();
        refresh();
      },
    });
  }

  if (!data) return null;
  const portalUrl = `/p/${form.slug}`;

  const visibleVideos = videos.filter((v) =>
    currentFolder ? v.folder_id === currentFolder : !v.folder_id
  );
  const visibleImages = images.filter((i) =>
    currentFolder ? i.folder_id === currentFolder : !i.folder_id
  );
  const openFolder = folders.find((f) => f.id === currentFolder) || null;
  const selectedCount = selectedVideos.size + selectedImages.size;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <a href="/admin" className="font-mono text-xs uppercase tracking-eyebrow text-mist">
        ← Összes projekt
      </a>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Beállítások */}
        <section className="rounded-2xl border border-ink-line bg-ink-card p-4 sm:p-6">
          <h2 className="font-display text-xl text-bone">Projekt adatai</h2>
          <div className="mt-5 space-y-3">
            {[
              ["title", "Projekt címe"],
              ["client_name", "Ügyfél neve"],
              ["project_date", "Dátum (pl. 2026-06-17)"],
              ["slug", "Portál azonosító (slug)"],
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
                  Borítókép
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ember px-3 py-1.5 text-xs font-medium text-white transition hover:bg-ember/90">
                    <Upload className="h-3.5 w-3.5" />
                    Feltöltés
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onCoverUpload}
                    />
                  </label>
                  {form.cover_image_url && (
                    <button
                      type="button"
                      onClick={onDeleteCover}
                      className="text-xs text-mist hover:text-ember hover:underline"
                    >
                      Eltávolítás
                    </button>
                  )}
                </div>
              </div>
              {form.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.cover_image_url}
                  alt="Borító"
                  className="mt-2 h-32 w-full rounded-2xl border border-ink-line object-cover"
                />
              )}
            </div>

            <div>
              <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                Leírás
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="mt-1.5 w-full rounded-2xl border border-ink-line bg-ink px-4 py-3 text-bone outline-none focus:border-ember/60"
              />
            </div>

            <div>
              <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                Márka
              </label>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, brand: "hype" }))}
                  className={`flex-1 rounded-full border px-4 py-2 text-sm transition ${
                    form.brand === "hype"
                      ? "border-ember bg-ember/10 text-bone"
                      : "border-ink-line text-mist hover:text-bone"
                  }`}
                >
                  HYPE
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, brand: "contentbee" }))}
                  className={`flex-1 rounded-full border px-4 py-2 text-sm transition ${
                    form.brand === "contentbee"
                      ? "border-ember bg-ember/10 text-bone"
                      : "border-ink-line text-mist hover:text-bone"
                  }`}
                >
                  ContentBee
                </button>
              </div>
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                Elérhető eddig
              </label>
              <input
                type="date"
                value={form.expires_at}
                onChange={(e) => onChangeExpiry(e.target.value)}
                className="mt-1.5 w-full rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
              />
              {form.expires_at && (
                <p className="mt-1.5 text-xs text-mist">
                  {(() => {
                    const d = daysLeft();
                    if (d === null) return null;
                    if (d < 0) return "Lejárt — a portál rejtve van az ügyfelek elől.";
                    if (d === 0) return "Ma jár le.";
                    return `${d} nap van hátra, amíg a portál elrejti a tartalmat.`;
                  })()}
                </p>
              )}
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                Lejáratkor
              </label>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, payment_mode: "contact" }))}
                  className={`flex-1 rounded-full border px-4 py-2 text-sm transition ${
                    form.payment_mode === "contact"
                      ? "border-ember bg-ember/10 text-bone"
                      : "border-ink-line text-mist hover:text-bone"
                  }`}
                >
                  Kapcsolatfelvétel
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, payment_mode: "paid" }))}
                  className={`flex-1 rounded-full border px-4 py-2 text-sm transition ${
                    form.payment_mode === "paid"
                      ? "border-ember bg-ember/10 text-bone"
                      : "border-ink-line text-mist hover:text-bone"
                  }`}
                >
                  Fizetős hosszabbítás
                </button>
              </div>
              <p className="mt-1.5 text-xs text-mist">
                {form.payment_mode === "paid"
                  ? "Az ügyfelek fizetéssel meghosszabbíthatják a hozzáférést lejárat után."
                  : "Az ügyfelek kapcsolatfelvételi üzenetet látnak lejárat után."}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                  Jelszó {data.has_password ? "(beállítva)" : "(nincs)"}
                </label>
                {data.has_password && (
                  <button
                    type="button"
                    onClick={clearPassword}
                    className="text-xs text-ember hover:underline"
                  >
                    Jelszó törlése
                  </button>
                )}
              </div>
              <input
                type="password"
                value={form.password}
                placeholder={data.has_password ? "Új jelszó (üresen hagyva megmarad)" : "Jelszó beállítása"}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1.5 w-full rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={save}>
              <Save className="h-4 w-4" />
              {saved ? "Mentve" : "Mentés"}
            </Button>
            <Button variant="ghost" asChild>
              <a href={portalUrl} target="_blank">
                Portál megtekintése
              </a>
            </Button>
            <Button variant="ghost" onClick={makeShare}>
              <Link2 className="h-4 w-4" />
              Megosztó link
            </Button>
            <button
              onClick={onDeleteProject}
              className="ml-auto flex items-center gap-2 rounded-full border border-ember/40 px-4 py-2 text-sm text-ember transition hover:bg-ember/10"
            >
              <Trash2 className="h-4 w-4" />
              Projekt törlése
            </button>
          </div>
          {shareUrl && (
            <p className="mt-3 break-all rounded-xl border border-ink-line bg-ink px-3 py-2 font-mono text-xs text-mist">
              Másolva: {shareUrl}
            </p>
          )}
        </section>

        {/* Fájlok / Mappák (Drive-szerű) */}
        <section className="rounded-2xl border border-ink-line bg-ink-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {currentFolder && (
                <button
                  onClick={() => setCurrentFolder(null)}
                  title="Vissza"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist transition hover:bg-white/[0.05] hover:text-bone"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <h2 className="truncate font-display text-xl text-bone">
                {openFolder ? openFolder.name : "Tartalom"}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onCreateFolder}>
                <FolderPlus className="h-4 w-4" />
                Új mappa
              </Button>
            </div>
            <input ref={replaceRef} type="file" accept="video/*" hidden onChange={onReplace} />
          </div>

          <p className="mt-2 text-xs text-mist">
            {currentFolder
              ? "A feltöltött videók és képek ebbe a mappába kerülnek."
              : "Nyiss meg egy mappát, vagy tölts fel ide videókat és képeket mappa nélkül."}
          </p>

          {/* Drag & drop zóna — Atlas böngészőben is működik, mert nincs fájlválasztó */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDropFiles}
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
              dragOver
                ? "border-ember bg-ember/10"
                : "border-ink-line bg-ink hover:border-ember/50"
            }`}
          >
            <Upload className="h-6 w-6 text-mist" />
            <span className="text-sm text-bone">
              Húzd ide a fájlokat vagy egy egész mappát
            </span>
            <span className="text-[11px] text-mist">
              Mappa húzásakor automatikusan létrejön a mappa a benne lévő fájlokkal. Vagy kattints a tallózáshoz.
            </span>
            <input
              type="file"
              accept="video/*,image/*"
              multiple
              className="hidden"
              onChange={onUpload}
            />
          </label>

          {/* Kijelölés sáv */}
          {(selectedCount > 0 || visibleVideos.length + visibleImages.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2.5">
              <span className="text-sm text-bone">
                {selectedCount > 0 ? `${selectedCount} kijelölve` : "Kijelölés"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={selectAllVisible}
                  className="rounded-full border border-ink-line px-3 py-1.5 text-xs text-bone transition hover:border-ember/50"
                >
                  Összes kijelölése
                </button>

                {selectedCount > 0 && (
                  <>
                    {/* Áthelyezés mappába (legördülő) */}
                    <div className="relative">
                      <button
                        onClick={() => setMoveMenuOpen((o) => !o)}
                        className="flex items-center gap-2 rounded-full border border-ink-line px-3 py-1.5 text-xs text-bone transition hover:border-ember/50"
                      >
                        <FolderIcon className="h-3.5 w-3.5" />
                        Áthelyezés mappába
                      </button>
                      {moveMenuOpen && (
                        <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-ink-line bg-ink-card shadow-xl">
                          <div className="max-h-64 overflow-y-auto py-1">
                            {folders.length === 0 && (
                              <p className="px-3 py-2 text-xs text-mist">
                                Nincs mappa. Előbb hozz létre egyet.
                              </p>
                            )}
                            {folders.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => moveSelectedToFolder(f.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-bone transition hover:bg-white/[0.05]"
                              >
                                <FolderIcon className="h-4 w-4 shrink-0 text-ember" />
                                <span className="truncate">{f.name}</span>
                              </button>
                            ))}
                            {currentFolder && (
                              <button
                                onClick={() => moveSelectedToFolder(null)}
                                className="flex w-full items-center gap-2 border-t border-ink-line px-3 py-2 text-left text-sm text-mist transition hover:bg-white/[0.05] hover:text-bone"
                              >
                                <ArrowLeft className="h-4 w-4 shrink-0" />
                                Kivétel a mappából
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={clearSelection}
                      className="text-xs text-mist transition hover:text-bone"
                    >
                      Mégse
                    </button>
                    <button
                      onClick={onDeleteSelected}
                      className="flex items-center gap-2 rounded-full border border-ember/50 px-3 py-1.5 text-xs text-ember transition hover:bg-ember/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Kijelöltek törlése
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {batch && (
            <div className="mt-4 rounded-xl border border-ember/40 bg-ember/10 px-3 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm text-bone">
                  Feltöltés: {batch.done} / {batch.total} kép
                </span>
                <span className="font-mono text-[11px] text-mist">
                  {(() => {
                    if (batch.done === 0) return "Becslés…";
                    const elapsed = (Date.now() - batch.startedAt) / 1000;
                    const perItem = elapsed / batch.done;
                    const remaining = Math.round(perItem * (batch.total - batch.done));
                    if (remaining < 60) return `~${remaining} mp van hátra`;
                    return `~${Math.ceil(remaining / 60)} perc van hátra`;
                  })()}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-line">
                <div
                  className="h-full rounded-full bg-ember transition-all duration-300"
                  style={{ width: `${Math.round((batch.done / batch.total) * 100)}%` }}
                />
              </div>
              <button
                onClick={cancelUploadNow}
                className="mt-2.5 w-full rounded-full border border-ember/50 py-1.5 text-xs text-ember transition hover:bg-ember/20"
              >
                Feltöltés leállítása
              </button>
            </div>
          )}

          {videoBatch && (
            <div className="mt-4 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-bone">
                  Videó feltöltése: {Math.min(videoBatch.done + 1, videoBatch.total)} /{" "}
                  {videoBatch.total}
                </span>
                <span className="font-mono text-[11px] text-mist">
                  {(() => {
                    if (videoBatch.done === 0) return "Becslés…";
                    const elapsed = (Date.now() - videoBatch.startedAt) / 1000;
                    const perItem = elapsed / videoBatch.done;
                    const remaining = Math.round(perItem * (videoBatch.total - videoBatch.done));
                    if (remaining < 60) return `~${remaining} mp van hátra`;
                    return `~${Math.ceil(remaining / 60)} perc van hátra`;
                  })()}
                </span>
              </div>
            </div>
          )}

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

          {/* Mappák (csak gyökérben) */}
          {!currentFolder && folders.length > 0 && (
            <ul className="mt-4 space-y-2">
              {folders.map((f) => {
                const vCount = videos.filter((v) => v.folder_id === f.id).length;
                const iCount = images.filter((i) => i.folder_id === f.id).length;
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
                        {vCount + iCount} elem
                      </span>
                    </button>
                    <button
                      title="Átnevezés"
                      onClick={() => onRenameFolder(f.id)}
                      className="text-mist transition hover:text-bone"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      title="Mappa törlése"
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

          {/* Videók az aktuális nézetben */}
          <ul className="mt-2 space-y-2">
            {visibleVideos.map((v, vIndex) => {
              const isSelected = selectedVideos.has(v.id);
              return (
                <li
                  key={v.id}
                  draggable={!isSelected}
                  onDragStart={() => (dragId.current = v.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(v.id)}
                  className={`flex items-center gap-2 rounded-xl border bg-ink px-2.5 py-2.5 sm:gap-3 sm:px-3 ${
                    isSelected ? "border-ember/60" : "border-ink-line"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      clickVideo(vIndex, (e as React.MouseEvent).shiftKey);
                    }}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-ember"
                  />
                  <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-mist sm:block" />
                  <div className="h-9 w-12 shrink-0 overflow-hidden rounded bg-ink-soft sm:w-16">
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
                        ? "Feldolgozás…"
                        : "Sikertelen"}
                    </p>
                  </div>
                  {currentFolder && (
                    <button
                      title="Kivétel a mappából"
                      onClick={() => onRemoveFromFolder(v.id)}
                      className="text-mist transition hover:text-bone"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    title="Átnevezés"
                    onClick={() => onRenameVideo(v.id)}
                    className="text-mist transition hover:text-bone"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    title="Csere"
                    onClick={() => {
                      replaceId.current = v.id;
                      replaceRef.current?.click();
                    }}
                    className="text-mist transition hover:text-bone"
                  >
                    <Replace className="h-4 w-4" />
                  </button>
                  <button
                    title="Törlés"
                    onClick={() => onDeleteVideo(v.id)}
                    className="text-mist transition hover:text-ember"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
            {visibleVideos.length === 0 && (
              <li className="py-8 text-center text-sm text-mist">
                {currentFolder
                  ? "Nincs videó ebben a mappában."
                  : "Nincs mappán kívüli videó."}
              </li>
            )}
          </ul>

          {/* Képek az aktuális nézetben */}
          {visibleImages.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 font-mono text-[11px] uppercase tracking-eyebrow text-mist">
                Képek ({visibleImages.length})
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {visibleImages.map((img, imgIndex) => (
                  <LazyImageCell
                    key={img.id}
                    img={img}
                    selected={selectedImages.has(img.id)}
                    inFolder={!!currentFolder}
                    onToggle={(shift) => clickImage(imgIndex, shift)}
                    onRemoveFromFolder={() => onRemoveImageFromFolder(img.id)}
                    onDelete={() => onDeleteImage(img.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {prompt && (
        <PromptDialog
          title={prompt.title}
          initialValue={prompt.value}
          onCancel={() => setPrompt(null)}
          onConfirm={(value) => {
            const cb = prompt.onConfirm;
            setPrompt(null);
            cb(value);
          }}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            const cb = confirmDialog.onConfirm;
            setConfirmDialog(null);
            cb();
          }}
        />
      )}
    </main>
  );
}

function LazyImageCell({
  img,
  selected,
  inFolder,
  onToggle,
  onRemoveFromFolder,
  onDelete,
}: {
  img: ImageType;
  selected: boolean;
  inFolder: boolean;
  onToggle: (shift: boolean) => void;
  onRemoveFromFolder: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "600px 0px" } // a látható terület felett/alatt 600px-rel előtölt
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`group relative aspect-square overflow-hidden rounded-lg border bg-ink-soft ${
        selected ? "border-ember/60 ring-2 ring-ember/40" : "border-ink-line"
      }`}
    >
      {/* A kép és a vezérlők CSAK akkor renderelődnek, ha a cella látható közelben.
          Így 800+ képnél is könnyű marad a DOM. */}
      {visible && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.thumbnail_url || img.url}
            alt={img.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <label
            className="absolute left-2 top-2 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => {}}
              onClick={(e) => {
                e.stopPropagation();
                onToggle((e as React.MouseEvent).shiftKey);
              }}
              className="h-4 w-4 cursor-pointer accent-ember"
            />
          </label>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition group-hover:opacity-100">
            {inFolder && (
              <button
                title="Kivétel a mappából"
                onClick={onRemoveFromFolder}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-bone transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <button
              title="Törlés"
              onClick={onDelete}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-bone transition hover:text-ember"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
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

function PromptDialog({
  title,
  initialValue,
  onCancel,
  onConfirm,
}: {
  title: string;
  initialValue: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg text-bone">{title}</h3>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(value);
            if (e.key === "Escape") onCancel();
          }}
          className="mt-4 w-full rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
        />
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Mégse
          </Button>
          <Button variant="primary" size="sm" onClick={() => onConfirm(value)}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm leading-relaxed text-bone">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Mégse
          </Button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 rounded-full border border-ember/40 px-4 py-2 text-sm text-ember transition hover:bg-ember/10"
          >
            Törlés
          </button>
        </div>
      </div>
    </div>
  );
}
