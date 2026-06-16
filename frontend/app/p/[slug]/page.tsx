"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getPublicProject, getByShare, PublicProject } from "@/lib/api";
import { PortalView } from "@/components/portal-view";
import { PasswordGate } from "@/components/password-gate";

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <span className="font-mono text-xs uppercase tracking-eyebrow text-mist">
            Loading portal…
          </span>
        </main>
      }
    >
      <PortalContent />
    </Suspense>
  );
}

function PortalContent() {
  const params = useParams();
  const search = useSearchParams();
  const slug = params.slug as string;
  const shareToken = search.get("share");

  const [project, setProject] = useState<PublicProject | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockMeta, setLockMeta] = useState<{ title?: string; cover?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(unlockToken?: string) {
    setLoading(true);
    try {
      if (shareToken) {
        const data = await getByShare(shareToken);
        setProject(data.project);
        setLocked(false);
      } else {
        const stored =
          unlockToken || sessionStorage.getItem(`hype_unlock_${slug}`) || undefined;
        const data = await getPublicProject(slug, stored);
        if (data.locked) {
          setLocked(true);
          setLockMeta({ title: data.title, cover: data.cover_image_url });
        } else if (data.project) {
          setProject(data.project);
          setLocked(false);
        }
      }
    } catch {
      setError("This portal could not be found.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, shareToken]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="font-mono text-xs uppercase tracking-eyebrow text-mist">
          Loading portal…
        </span>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-3xl text-bone">Portal not found</h1>
        <p className="text-mist">{error}</p>
      </main>
    );
  }

  if (locked) {
    return (
      <PasswordGate
        slug={slug}
        title={lockMeta.title}
        cover={lockMeta.cover}
        onUnlock={(t) => load(t)}
      />
    );
  }

  return project ? <PortalView project={project} /> : null;
}
