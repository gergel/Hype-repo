"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, ArrowDown, Loader2, ChevronDown, X } from "lucide-react";
import { PublicProject, Video, Image as ImageType } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";
import { VideoPlayer } from "@/components/video-player";
import { downloadVideo, downloadImage, downloadImagesAll } from "@/lib/utils";

const CONTENTBEE_ACCENT = "rgb(243, 199, 68)";

export function PortalView({ project }: { project: PublicProject }) {
  const [active, setActive] = useState<Video | null>(null);
  const [lightbox, setLightbox] = useState<ImageType | null>(null);
  const hasCustomCover = !!project.cover_image_url;

  const isContentBee = project.brand === "contentbee";
  const brandLabel = isContentBee ? "ContentBee" : "HYPE Productions";
  const accent = isContentBee ? CONTENTBEE_ACCENT : undefined;
  const defaultCoverMobile = isContentBee
    ? "/contentbee-mobile.png"
    : "/default-cover-mobile.PNG";
  const defaultCoverDesktop = isContentBee
    ? "/contentbee-desktop.png"
    : "/default-cover-desktop.png";

  const folders = project.folders || [];
  const looseVideos = project.videos.filter((v) => !v.folder_id);
  const foldersWithVideos = folders
    .map((f) => ({
      folder: f,
      videos: project.videos.filter((v) => v.folder_id === f.id),
    }))
    .filter((g) => g.videos.length > 0);

  const allImages = project.images || [];
  const looseImages = allImages.filter((i) => !i.folder_id);
  const foldersWithImages = folders
    .map((f) => ({
      folder: f,
      images: allImages.filter((i) => i.folder_id === f.id),
    }))
    .filter((g) => g.images.length > 0);

  return (
    <main className="relative">
      {/* ---------- Hero ---------- */}
      <section className="relative flex min-h-[88vh] items-end overflow-hidden">
        <div className="absolute inset-0">
          {hasCustomCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.cover_image_url}
              alt=""
              className="h-full w-full origin-center object-cover animate-drift"
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={defaultCoverMobile}
                alt=""
                className="h-full w-full origin-center object-cover animate-drift sm:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={defaultCoverDesktop}
                alt=""
                className="hidden h-full w-full origin-center object-cover animate-drift sm:block"
              />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/60 to-transparent" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-24">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="font-mono text-xs uppercase tracking-eyebrow"
            style={{ color: isContentBee ? CONTENTBEE_ACCENT : undefined }}
          >
            {!isContentBee && <span className="text-mist">{brandLabel} · </span>}
            {isContentBee ? `${brandLabel} · ` : ""}
            <span className={isContentBee ? "" : "text-mist"}>
              {project.client_name || "Client"}
              {project.project_date ? ` · ${project.project_date}` : ""}
            </span>
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 max-w-3xl font-display text-5xl leading-[1.04] text-bone sm:text-7xl"
          >
            {project.title}
          </motion.h1>

          {project.description && (
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-mist"
            >
              {project.description}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <DownloadAllButton videos={project.videos} />
            <Button variant="ghost" size="lg" asChild>
              <a href="#films">
                {project.videos.length} {project.videos.length === 1 ? "film" : "films"}
                <ArrowDown className="h-4 w-4" />
              </a>
            </Button>
            {allImages.length > 0 && (
              <Button variant="ghost" size="lg" asChild>
                <a href="#images">
                  {allImages.length} {allImages.length === 1 ? "photo" : "photos"}
                  <ArrowDown className="h-4 w-4" />
                </a>
              </Button>
            )}
          </motion.div>
        </div>
      </section>

      {/* ---------- Films ---------- */}
      <section id="films" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="mb-10 flex items-end justify-between border-b border-ink-line pb-6">
          <h2 className="font-display text-2xl text-bone sm:text-3xl">The films</h2>
          <span className="font-mono text-xs uppercase tracking-eyebrow text-mist">
            Stream · Download
          </span>
        </div>

        {project.videos.length === 0 ? (
          <p className="py-16 text-center text-mist">
            Films are being prepared. Check back shortly.
          </p>
        ) : (
          <div className="space-y-12">
            {looseVideos.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {looseVideos.map((v, i) => (
                  <VideoCard key={v.id} video={v} index={i} onPlay={setActive} />
                ))}
              </div>
            )}

            {foldersWithVideos.map(({ folder, videos }) => (
              <FolderSection
                key={folder.id}
                name={folder.name}
                videos={videos}
                onPlay={setActive}
                accent={accent}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---------- Images ---------- */}
      {allImages.length > 0 && (
        <section id="images" className="mx-auto max-w-6xl px-6 pb-20 sm:pb-28">
          <div className="mb-10 flex items-end justify-between border-b border-ink-line pb-6">
            <h2 className="font-display text-2xl text-bone sm:text-3xl">Photos</h2>
            <ImagesDownloadButton
              images={allImages}
              label={`Download all (${allImages.length})`}
            />
          </div>

          <div className="space-y-12">
            {looseImages.length > 0 && (
              <ImageGrid images={looseImages} onOpen={setLightbox} />
            )}

            {foldersWithImages.map(({ folder, images }) => (
              <ImageFolderSection
                key={folder.id}
                name={folder.name}
                images={images}
                onOpen={setLightbox}
                accent={accent}
              />
            ))}
          </div>
        </section>
      )}

      <footer className="mx-auto max-w-6xl px-6 pb-16 pt-4">
        <p className="font-mono text-xs uppercase tracking-eyebrow text-mist">
          © {new Date().getFullYear()} {brandLabel} — Private delivery
        </p>
      </footer>

      {active && <VideoPlayer video={active} onClose={() => setActive(null)} />}
      {lightbox && (
        <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
      )}
    </main>
  );
}

function FolderSection({
  name,
  videos,
  onPlay,
  accent,
}: {
  name: string;
  videos: Video[];
  onPlay: (v: Video) => void;
  accent?: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-6 flex w-full items-center justify-between border-b border-ink-line pb-3 text-left transition hover:border-ember/40"
      >
        <h3
          className="font-display text-xl text-bone sm:text-2xl"
          style={accent ? { color: accent } : undefined}
        >
          {name}
        </h3>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-eyebrow text-mist">
          {videos.length} {videos.length === 1 ? "film" : "films"}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-6 pb-2 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v, i) => (
                <VideoCard key={v.id} video={v} index={i} onPlay={onPlay} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ImageFolderSection({
  name,
  images,
  onOpen,
  accent,
}: {
  name: string;
  images: ImageType[];
  onOpen: (img: ImageType) => void;
  accent?: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-6 flex w-full items-center justify-between border-b border-ink-line pb-3 text-left transition hover:border-ember/40"
      >
        <h3
          className="font-display text-xl text-bone sm:text-2xl"
          style={accent ? { color: accent } : undefined}
        >
          {name}
        </h3>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-eyebrow text-mist">
          {images.length} {images.length === 1 ? "photo" : "photos"}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-2">
              <ImageGrid images={images} onOpen={onOpen} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ImageGrid({
  images,
  onOpen,
}: {
  images: ImageType[];
  onOpen: (img: ImageType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img) => (
        <button
          key={img.id}
          onClick={() => onOpen(img)}
          className="group relative aspect-square overflow-hidden rounded-2xl border border-ink-line bg-ink-card"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
        </button>
      ))}
    </div>
  );
}

function ImageLightbox({
  image,
  onClose,
}: {
  image: ImageType;
  onClose: () => void;
}) {
  const [preparing, setPreparing] = useState(false);

  async function handleDownload() {
    if (preparing) return;
    setPreparing(true);
    try {
      const ext = image.url.split("?")[0].split(".").pop() || "jpg";
      await downloadImage(image.url, `${image.title || "image"}.${ext}`);
    } finally {
      setTimeout(() => setPreparing(false), 1000);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-bone transition hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
        <motion.div
          className="flex max-h-full max-w-5xl flex-col items-center gap-4"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.title}
            className="max-h-[78vh] w-auto rounded-2xl object-contain"
          />
          <button
            onClick={handleDownload}
            disabled={preparing}
            className="flex min-w-[160px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-bone px-6 py-3 text-sm font-medium text-ink transition hover:bg-white disabled:opacity-60"
          >
            {preparing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            {preparing ? "Preparing…" : "Download"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DownloadAllButton({ videos }: { videos: Video[] }) {
  const [busy, setBusy] = useState(false);

  async function downloadAll() {
    if (busy) return;
    setBusy(true);
    try {
      for (const v of videos) {
        if (!v.mp4_url) continue;
        await downloadVideo(v.id, v.mp4_url, `${v.title}.mp4`, v.size_bytes);
        await new Promise((r) => setTimeout(r, 800));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="primary" size="lg" onClick={downloadAll} disabled={!videos.length || busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "Preparing…" : "Download all"}
    </Button>
  );
}

function ImagesDownloadButton({
  images,
  label,
}: {
  images: ImageType[];
  label: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    try {
      await downloadImagesAll(images.map((i) => ({ url: i.url, title: i.title })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={busy}
      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-bone px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "Preparing…" : label}
    </button>
  );
}
