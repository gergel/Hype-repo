"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Download, ArrowDown, Loader2 } from "lucide-react";
import { PublicProject, Video, Folder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";
import { VideoPlayer } from "@/components/video-player";
import { downloadVideo } from "@/lib/utils";

export function PortalView({ project }: { project: PublicProject }) {
  const [active, setActive] = useState<Video | null>(null);
  const hasCustomCover = !!project.cover_image_url;

  const folders = project.folders || [];
  // Mappa nélküli videók (folder_id üres/null)
  const looseVideos = project.videos.filter((v) => !v.folder_id);
  // Csak azok a mappák, amikben van videó
  const foldersWithVideos = folders
    .map((f) => ({
      folder: f,
      videos: project.videos.filter((v) => v.folder_id === f.id),
    }))
    .filter((g) => g.videos.length > 0);

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
                src="/default-cover-mobile.PNG"
                alt=""
                className="h-full w-full origin-center object-cover animate-drift sm:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/default-cover-desktop.png"
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
            className="font-mono text-xs uppercase tracking-eyebrow text-mist"
          >
            HYPE Production · {project.client_name || "Client"}
            {project.project_date ? ` · ${project.project_date}` : ""}
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
          <div className="space-y-16">
            {/* Mappa nélküli videók (cím nélkül, legfelül) */}
            {looseVideos.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {looseVideos.map((v, i) => (
                  <VideoCard key={v.id} video={v} index={i} onPlay={setActive} />
                ))}
              </div>
            )}

            {/* Mappánkénti szekciók */}
            {foldersWithVideos.map(({ folder, videos }) => (
              <div key={folder.id}>
                <h3 className="mb-6 font-display text-xl text-bone sm:text-2xl">
                  {folder.name}
                </h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {videos.map((v, i) => (
                    <VideoCard key={v.id} video={v} index={i} onPlay={setActive} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-16 pt-4">
        <p className="font-mono text-xs uppercase tracking-eyebrow text-mist">
          © {new Date().getFullYear()} HYPE Production — Private delivery
        </p>
      </footer>

      {active && <VideoPlayer video={active} onClose={() => setActive(null)} />}
    </main>
  );
}

function DownloadAllButton({ videos }: { videos: Video[] }) {
  const [busy, setBusy] = useState(false);

  async function downloadAll() {
    if (busy) return;
    setBusy(true);
    try {
      // egyenként, sorban — minden videó az új letöltési móddal
      for (const v of videos) {
        if (!v.mp4_url) continue;
        await downloadVideo(v.id, v.mp4_url, `${v.title}.mp4`, v.size_bytes);
        // kis szünet a böngésző letöltéskezelőjének
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
