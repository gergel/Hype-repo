"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  ArrowDown,
  Loader2,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { PublicProject, Video, Image as ImageType, startPayment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";
import { VideoPlayer } from "@/components/video-player";
import { downloadVideo, downloadImage, downloadImagesAll } from "@/lib/utils";

const CONTENTBEE_ACCENT = "rgb(243, 199, 68)";

export function PortalView({
  project,
  expiredContactEmail,
  expiredPaymentMode,
}: {
  project: PublicProject;
  expiredContactEmail?: string;
  expiredPaymentMode?: string;
}) {
  const [active, setActive] = useState<Video | null>(null);
  const [lightbox, setLightbox] = useState<{ images: ImageType[]; index: number } | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [aszfOpen, setAszfOpen] = useState(false);
  const hasCustomCover = !!project.cover_image_url;
  const isExpired = !!expiredContactEmail;

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

  function daysUntilExpiry(): number | null {
    if (!project.expires_at) return null;
    const exp = new Date(project.expires_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDay = new Date(exp);
    expDay.setHours(0, 0, 0, 0);
    return Math.round((expDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  const remainingDays = isExpired ? null : daysUntilExpiry();
  const isPaid = project.payment_mode === "paid";

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

          {!isExpired && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <DownloadAllButton videos={project.videos} images={allImages} />
              {project.videos.length > 0 && (
                <Button variant="ghost" size="lg" asChild>
                  <a href="#films">
                    {project.videos.length} {project.videos.length === 1 ? "film" : "films"}
                    <ArrowDown className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {allImages.length > 0 && (
                <Button variant="ghost" size="lg" asChild>
                  <a href="#images">
                    {allImages.length} {allImages.length === 1 ? "photo" : "photos"}
                    <ArrowDown className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </motion.div>
          )}
        </div>
      </section>

      {/* ---------- Elérhetőség sáv ---------- */}
      {!isExpired && remainingDays !== null && (
        <div className="border-b border-ink-line bg-ink-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
            <span className="text-sm text-mist">
              {remainingDays > 0
                ? `Az anyagok még ${remainingDays} napig elérhetők`
                : "Az anyagok ma járnak le"}
            </span>
            
              <a href="#legal"
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-eyebrow text-mist transition hover:text-bone"
            >
              <Info className="h-3.5 w-3.5" />
              Részletek
            </a>
          </div>
        </div>
      )}

      {/* ---------- Expired ---------- */}
      {isExpired && (
        <section className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
          <div className="rounded-2xl border border-ink-line bg-ink-card p-8 sm:p-10 text-center">
            <h2
              className="font-display text-2xl text-bone sm:text-3xl"
              style={accent ? { color: accent } : undefined}
            >
              Ez a projekt már nem elérhető
            </h2>

            {expiredPaymentMode === "paid" ? (
              <>
                <p className="mt-4 text-base leading-relaxed text-mist">
                  Az anyagok újbóli eléréséhez válassz az alábbi csomagok közül.
                </p>
                <PaymentPackages
                  slug={project.slug}
                  accent={accent}
                  onOpenAszf={() => setAszfOpen(true)}
                />
                <p className="mt-6 text-sm text-mist">
                  Kérdésed van? Írj nekünk:{" "}
                  
                    <a href={`mailto:${expiredContactEmail}`}
                    className="text-bone underline underline-offset-4 transition hover:text-ember"
                  >
                    {expiredContactEmail}
                  </a>
                </p>
              </>
            ) : (
              <p className="mt-4 text-base leading-relaxed text-mist">
                Ha újra szükséged van az anyagokra, vedd fel velünk a kapcsolatot:{" "}
                
                  <a href={`mailto:${expiredContactEmail}`}
                  className="text-bone underline underline-offset-4 transition hover:text-ember"
                >
                  {expiredContactEmail}
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---------- Films ---------- */}
      {!isExpired && project.videos.length > 0 && (
        <section id="films" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mb-10 flex items-end justify-between border-b border-ink-line pb-6">
            <h2 className="font-display text-2xl text-bone sm:text-3xl">The films</h2>
            <span className="font-mono text-xs uppercase tracking-eyebrow text-mist">
              Stream · Download
            </span>
          </div>

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
        </section>
      )}

      {/* ---------- Images ---------- */}
      {!isExpired && allImages.length > 0 && (
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
              <ImageGrid
                images={looseImages}
                onOpen={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
              />
            )}

            {foldersWithImages.map(({ folder, images }) => (
              <ImageFolderSection
                key={folder.id}
                name={folder.name}
                images={images}
                onOpen={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
                accent={accent}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Jogi szöveg (fizetős) ---------- */}
      {!isExpired && isPaid && (
        <section id="legal" className="mx-auto max-w-3xl px-6 py-16">
          <div className="border-t border-ink-line pt-10">
            <h2 className="font-display text-xl text-bone sm:text-2xl">
              Elérhetőség és felhasználási feltételek
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-mist">
              <p>
                Az elkészült fájlokat a HypeClient rendszerében 30 napig díjmentesen
                elérheted és letöltheted. A 30 nap lejárta után az online hozzáférés
                megszűnik, kivéve, ha tárhelycsomagot rendelsz. Fizetős előfizetés nem
                indul automatikusan. A fájlokat ezt követően további 3 hónapig
                archiváljuk, majd véglegesen töröljük, ezért kérjük, időben gondoskodj a
                letöltésükről vagy hosszabb távú tárolásukról.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => setTermsOpen(true)}
                className="rounded-full border border-ink-line px-5 py-2.5 text-sm text-bone transition hover:border-ember/60"
              >
                Teljes felhasználási feltételek
              </button>
              <button
                onClick={() => setAszfOpen(true)}
                className="rounded-full border border-ink-line px-5 py-2.5 text-sm text-bone transition hover:border-ember/60"
              >
                ÁSZF
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Csak ÁSZF (nem fizetős) ---------- */}
      {!isExpired && !isPaid && (
        <section id="legal" className="mx-auto max-w-3xl px-6 py-16">
          <div className="border-t border-ink-line pt-10">
            <button
              onClick={() => setAszfOpen(true)}
              className="rounded-full border border-ink-line px-5 py-2.5 text-sm text-bone transition hover:border-ember/60"
            >
              ÁSZF
            </button>
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
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(idx) => setLightbox({ images: lightbox.images, index: idx })}
        />
      )}
      {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} />}
      {aszfOpen && <AszfModal onClose={() => setAszfOpen(false)} />}
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
  onOpen: (images: ImageType[], index: number) => void;
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
  onOpen: (images: ImageType[], index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img, i) => (
        <button
          key={img.id}
          onClick={() => onOpen(images, i)}
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
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: ImageType[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const [preparing, setPreparing] = useState(false);
  const image = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  function goPrev() {
    if (hasPrev) onNavigate(index - 1);
  }
  function goNext() {
    if (hasNext) onNavigate(index + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length]);

  async function handleDownload() {
    if (preparing) return;
    setPreparing(true);
    try {
      await downloadImage(image.id, image.title);
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
          className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-bone transition hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>

        {hasPrev && (
          <button
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 text-bone transition hover:bg-white/10 sm:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {hasNext && (
          <button
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 text-bone transition hover:bg-white/10 sm:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <motion.div
          key={image.id}
          className="flex max-h-full max-w-5xl flex-col items-center gap-4"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.title}
            className="max-h-[78vh] w-auto rounded-2xl object-contain"
          />
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-mist">
              {index + 1} / {images.length}
            </span>
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DownloadAllButton({
  videos,
  images,
}: {
  videos: Video[];
  images: ImageType[];
}) {
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
      if (images.length > 0) {
        await downloadImagesAll(images.map((i) => ({ id: i.id, title: i.title })));
      }
    } finally {
      setBusy(false);
    }
  }

  const total = videos.length + images.length;
  return (
    <Button variant="primary" size="lg" onClick={downloadAll} disabled={!total || busy}>
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
      await downloadImagesAll(images.map((i) => ({ id: i.id, title: i.title })));
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

function PaymentPackages({
  slug,
  accent,
  onOpenAszf,
}: {
  slug: string;
  accent?: string;
  onOpenAszf: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const packages = [
    { code: "1month", label: "1 hónap", price: "6 000 Ft" },
    { code: "180days", label: "180 nap", price: "30 000 Ft" },
    { code: "1year", label: "1 év", price: "50 000 Ft" },
  ];

  async function pay(code: string) {
    if (busy || !accepted) return;
    setBusy(code);
    try {
      const url = await startPayment(slug, code);
      window.location.href = url;
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <label className="flex cursor-pointer items-start justify-center gap-2.5 text-left text-sm text-mist">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-ember"
        />
        <span>
          Elolvastam és elfogadom az{" "}
          <button
            type="button"
            onClick={onOpenAszf}
            className="text-bone underline underline-offset-4 transition hover:text-ember"
          >
            Általános Szerződési Feltételeket
          </button>
          .
        </span>
      </label>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {packages.map((p) => (
          <button
            key={p.code}
            onClick={() => pay(p.code)}
            disabled={!!busy || !accepted}
            className="flex flex-col items-center gap-1 rounded-2xl border border-ink-line bg-ink px-4 py-5 transition hover:border-ember/60 disabled:cursor-not-allowed disabled:opacity-40"
            style={busy === p.code && accent ? { borderColor: accent } : undefined}
          >
            <span className="font-display text-lg text-bone">{p.label}</span>
            <span className="font-mono text-sm text-mist">
              {busy === p.code ? "Átirányítás…" : p.price}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TermsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative my-8 w-full max-w-2xl rounded-2xl border border-ink-line bg-ink-card p-6 sm:p-10"
          initial={{ scale: 0.97, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Bezárás"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-ink-line text-mist transition hover:bg-white/5 hover:text-bone"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="pr-12 font-display text-2xl text-bone">
            Tájékoztató az elkészült anyagok online eléréséről és megőrzéséről
          </h2>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-mist">
            <p>
              Üdvözlünk a HypeClient online rendszerében! A HypeClient a Hype
              Productions Kft. által üzemeltetett online ügyfél- és fájlkezelő
              szolgáltatás.
            </p>
            <p>
              A HypeClient rendszerébe feltöltött elkészült anyagok a feltöltésről
              szóló értesítés megküldésétől számított 30 napon keresztül díjmentesen
              elérhetők és letölthetők. A díjmentes hozzáférési időszak alatt az
              anyagokat megtekintheted és letöltheted. Javasoljuk, hogy a megőrizni
              kívánt fájlokat ezen időszakon belül töltsd le, és gondoskodj azok saját
              eszközön vagy más, általad választott tárhelyen történő biztonságos
              tárolásáról.
            </p>

            <div>
              <h3 className="font-display text-base text-bone">
                Az online hozzáférés meghosszabbítása
              </h3>
              <p className="mt-2">
                A 30 napos díjmentes időszak lejártát követően az online hozzáférés
                megszűnik, kivéve, ha az ügyfél külön tárhelycsomagot választ és annak
                igénybevételét kifejezetten megrendeli. A díjmentes időszak lejárta nem
                eredményez automatikusan fizetős előfizetést vagy más díjfizetési
                kötelezettséget. Fizetési kötelezettség kizárólag az ügyfél kifejezett
                megrendelése alapján keletkezik.
              </p>
              <p className="mt-2">
                Az elérhető tárhelycsomagok, azok díjai és részletes feltételei a
                HypeClient felületén tekinthetők meg. Az előfizetés vagy tárhelycsomag
                megrendelése a HypeClient felületén keresztül történik, a kapcsolódó
                bankkártyás fizetések lebonyolítását pedig a Barion rendszere végzi. A
                bankkártyaadatok kezelése és a fizetési tranzakciók feldolgozása a Barion
                biztonságos fizetési felületén történik, amelyért és annak működéséért a
                Barion Payment Zrt. felelős. A Hype Productions Kft. a bankkártyaadatokat
                nem tárolja és azokhoz nem fér hozzá.
              </p>
            </div>

            <div>
              <h3 className="font-display text-base text-bone">
                Az anyagok archivált megőrzése
              </h3>
              <p className="mt-2">
                Amennyiben az ügyfél nem rendeli meg az online hozzáférés
                meghosszabbítását, a 30 napos díjmentes időszak lejártát követően az
                anyagok online elérhetősége megszűnik. Ezt követően a Hype Productions
                Kft. az anyagokat további 3 hónapig archivált, az ügyfél által közvetlenül
                nem hozzáférhető tárhelyen őrzi meg.
              </p>
              <p className="mt-2">
                Az archivált időszak alatt az anyagok ismételt hozzáférhetővé tétele vagy
                visszaállítása külön ügyfélkérelemre, a Hype Productions Kft.
                visszaigazolása alapján történhet. A visszaállításhoz kapcsolódó esetleges
                díjakról, teljesítési határidőkről és egyéb feltételekről a Hype
                Productions Kft. előzetesen tájékoztatást ad.
              </p>
            </div>

            <div>
              <h3 className="font-display text-base text-bone">Végleges törlés</h3>
              <p className="mt-2">
                A három hónapos archivált megőrzési időszak lejártát követően az anyagok
                és azok rendelkezésre álló másolatai a HypeClient rendszeréből, valamint a
                Hype Productions Kft. által használt aktív és archivált tárhelyekről
                véglegesen törlésre kerülnek. A törlést követően az anyagok
                visszaállítására, helyreállítására vagy ismételt rendelkezésre bocsátására
                nincs lehetőség.
              </p>
              <p className="mt-2">
                Kérjük, hogy amennyiben az anyagokat hosszabb távon is meg kívánod őrizni:
                töltsd le azokat a 30 napos díjmentes hozzáférési időszakon belül;
                gondoskodj saját biztonsági másolat készítéséről; vagy válassz a
                HypeClient felületén elérhető online tárhelycsomagok közül.
              </p>
            </div>

            <div>
              <h3 className="font-display text-base text-bone">Adatkezelés</h3>
              <p className="mt-2">
                Amennyiben az elkészült anyagok személyes adatokat tartalmaznak, azok
                kezelése és megőrzése a Hype Productions Kft. mindenkor hatályos
                Adatkezelési Tájékoztatójában, valamint az alkalmazandó szerződéses
                feltételekben foglaltak szerint történik.
              </p>
              <p className="mt-2">
                A HypeClient online tárhelyszolgáltatás részletes feltételeit, díjait, a
                szolgáltatás igénybevételének és megszüntetésének szabályait, valamint a
                felek jogait és kötelezettségeit az Általános Szerződési Feltételek
                tartalmazzák.
              </p>
              <p className="mt-2">
                Felhívjuk a figyelmedet, hogy hosszú távú megőrzés esetén ne hagyatkozz
                kizárólag a HypeClient online vagy archivált tárolási rendszerére. A
                megőrizni kívánt anyagokról minden esetben készíts saját biztonsági
                másolatot.
              </p>
            </div>

            <p className="border-t border-ink-line pt-4 text-xs text-mist">
              A HypeClient szolgáltatás üzemeltetője: Hype Productions Kft.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AszfModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const sections = [
    {
      h: "1. Szolgáltató adatai",
      p: "Cégnév: Hype Productions Korlátolt Felelősségű Társaság · Rövidített cégnév: Hype Productions Kft. · Székhely: 1045 Budapest, Virág utca 24. I. emelet 2. · Cégjegyzékszám: 01-09-988327 · Adószám: 23995828-2-41 · Nyilvántartó bíróság: Fővárosi Törvényszék Cégbírósága · E-mail: info@hypestab.hu · Honlap: https://hypeclient.com",
    },
    {
      h: "2. A szolgáltatás leírása",
      p: "A HypeClient a Hype Productions Kft. online ügyfél- és tárhelyszolgáltatása, amely lehetővé teszi az elkészült digitális fájlok online megtekintését, letöltését és meghatározott időtartamú tárolását.",
    },
    {
      h: "3. Díjmentes hozzáférés",
      p: "A HypeClient rendszerébe feltöltött elkészült anyagok a feltöltésről szóló értesítés megküldésétől számított 30 napon keresztül díjmentesen elérhetők és letölthetők. A 30 napos időszak lejártát követően az online hozzáférés megszűnik, kivéve, ha az ügyfél tárhelycsomagot rendel.",
    },
    {
      h: "4. Tárhelycsomagok",
      p: "A HypeClient tárhelycsomagjai egyszeri díjas szolgáltatások. A megvásárolt tárhelycsomag a választott időtartam lejártával automatikusan megszűnik. Ismétlődő díjfizetés, automatikus megújítás vagy automatikus bankkártyaterhelés nem történik.",
    },
    {
      h: "5. Fizetés",
      p: "A tárhelycsomagok díjának kiegyenlítése a Barion rendszerén keresztül történik. A bankkártyaadatok kezelése a Barion biztonságos felületén zajlik. A Hype Productions Kft. a bankkártyaadatokhoz nem fér hozzá és azokat nem tárolja. A szolgáltatásról elektronikus számla kerül kiállításra a Számlázz.hu rendszerén keresztül.",
    },
    {
      h: "6. Archiválás",
      p: "Amennyiben az ügyfél nem rendel tárhelycsomagot vagy a tárhelycsomag lejár, az anyagok online elérhetősége megszűnik. A Hype Productions Kft. ezt követően az anyagokat további 3 hónapig offline archivált, az ügyfél által közvetlenül nem hozzáférhető tárhelyen őrzi meg.",
    },
    {
      h: "7. Végleges törlés",
      p: "A 3 hónapos archiválási időszak lejártát követően az anyagok véglegesen törlésre kerülnek. A törlést követően az anyagok visszaállítására nincs lehetőség. Az ügyfél köteles gondoskodni a számára fontos fájlok saját biztonsági mentéséről.",
    },
    {
      h: "8. Felelősség",
      p: "A HypeClient nem minősül korlátlan archiválási vagy biztonsági mentési szolgáltatásnak. A Hype Productions Kft. nem felel az ügyfél által elmulasztott letöltésből vagy biztonsági mentés hiányából eredő károkért.",
    },
    {
      h: "9. Panaszkezelés",
      p: "Az ügyfél a szolgáltatással kapcsolatos panaszát az info@hypestab.hu e-mail címen jelentheti be. A szolgáltató a panaszt annak beérkezésétől számított 30 napon belül kivizsgálja és megválaszolja.",
    },
    {
      h: "10. Adatkezelés",
      p: "A személyes adatok kezelésére a Hype Productions Kft. Adatkezelési Tájékoztatója irányadó.",
    },
    {
      h: "11. Irányadó jog",
      p: "Jelen ÁSZF-re a magyar jog szabályai alkalmazandók. A jelen ÁSZF-ben nem szabályozott kérdésekben különösen a Polgári Törvénykönyv, az elektronikus kereskedelmi szolgáltatásokról szóló törvény, valamint a fogyasztóvédelmi és adatvédelmi jogszabályok rendelkezései az irányadók.",
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative my-8 w-full max-w-2xl rounded-2xl border border-ink-line bg-ink-card p-6 sm:p-10"
          initial={{ scale: 0.97, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Bezárás"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-ink-line text-mist transition hover:bg-white/5 hover:text-bone"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="pr-12 font-display text-2xl text-bone">
            Általános Szerződési Feltételek
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-mist">
            Hatályos: 2026
          </p>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-mist">
            {sections.map((s) => (
              <div key={s.h}>
                <h3 className="font-display text-base text-bone">{s.h}</h3>
                <p className="mt-2">{s.p}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
