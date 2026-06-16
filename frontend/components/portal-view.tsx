"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Download, ArrowDown } from "lucide-react";
import { PublicProject, Video } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";
import { VideoPlayer } from "@/components/video-player";
import { forceDownload } from "@/lib/utils";

export function PortalView({ project }: { project: PublicProject }) {
  const [active, setActive] = useState<Video | null>(null);
  const coverImage =
    project.cover_image_url ||
    project.videos.find((v) => v.thumbnail_url)?.thumbnail_url ||
    "";

  return (
    <main className="relative">
      {/* ---------- Hero ---------- */}
      <section className="relative flex min-h-[88vh] items-end overflow-hidden">
        {coverImage ? (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt=""
              className="h-full w-full origin-center object-cover animate-drift"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/60 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-ink-soft" />
        )}

        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-24">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="font-mono text-xs uppercase tracking-eyebrow text-mist"
          >
            HYPE Production · {project.client_name || "Client"}
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

      {/* ---------- Films grid ---------- */}
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {project.videos.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} onPlay={setActive} />
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
  function downloadAll() {
    videos.forEach((v, i) => {
      if (!v.mp4_url) return;
      setTimeout(() => {
        forceDownload(v.mp4_url, `${v.title}.mp4`);
      }, i * 800);
    });
  }
  return (
    <Button variant="primary" size="lg" onClick={downloadAll} disabled={!videos.length}>
      <Download className="h-4 w-4" />
      Download all
    </Button>
  );
}
