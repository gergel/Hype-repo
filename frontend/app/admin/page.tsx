"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Plus, ExternalLink, Trash2 } from "lucide-react";
import {
  adminLogin,
  listProjects,
  createProject,
  syncNotion,
  deleteProject,
  ProjectSummary,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(!!localStorage.getItem("hype_admin_token"));
  }, []);
  return authed ? <Dashboard /> : <Login onIn={() => setAuthed(true)} />;
}

function Login({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    try {
      await adminLogin(email, password);
      onIn();
    } catch {
      setError("Invalid credentials.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-ink-line bg-ink-card p-8"
      >
        <p className="font-mono text-xs uppercase tracking-eyebrow text-mist">
          HYPE Production
        </p>
        <h1 className="mt-2 font-display text-2xl text-bone">Admin sign in</h1>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-6 w-full rounded-full border border-ink-line bg-ink px-5 py-3 text-bone outline-none focus:border-ember/60"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-3 w-full rounded-full border border-ink-line bg-ink px-5 py-3 text-bone outline-none focus:border-ember/60"
        />
        {error && <p className="mt-3 text-sm text-ember">{error}</p>}
        <Button variant="ember" size="lg" className="mt-5 w-full" onClick={submit}>
          Sign in
        </Button>
      </motion.div>
    </main>
  );
}

function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "name">("date_desc");

  async function refresh() {
    setProjects(await listProjects());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function doSync() {
    setSyncing(true);
    try {
      await syncNotion();
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function doCreate() {
    if (!title) return;
    await createProject({ title, client_name: client, status: "live" });
    setTitle("");
    setClient("");
    setCreating(false);
    refresh();
  }

  async function onDelete(e: React.MouseEvent, id: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    const ok = window.confirm(
      `Are you sure you want to delete the project "${title}" along with all of its videos? This action cannot be undone.`
    );
    if (!ok) return;
    await deleteProject(id);
    refresh();
  }

  const visibleProjects = projects
    .filter((p) => {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        (p.project_date || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      const da = a.project_date || "";
      const db = b.project_date || "";
      if (sortBy === "date_asc") return da.localeCompare(db);
      return db.localeCompare(da); // date_desc
    });

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-eyebrow text-mist">
            HYPE Production
          </p>
          <h1 className="mt-1 font-display text-3xl text-bone">Projects</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={doSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync Notion
          </Button>
          <Button variant="ember" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </div>
      </div>

      {creating && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-line bg-ink-card p-4">
          <input
            placeholder="Project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
          />
          <input
            placeholder="Client name"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="flex-1 rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
          />
          <Button variant="primary" onClick={doCreate}>
            Create
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          placeholder="Keresés: projekt, ügyfél vagy dátum…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60"
        >
          <option value="date_desc">Dátum (legújabb elöl)</option>
          <option value="date_asc">Dátum (legrégebbi elöl)</option>
          <option value="name">Név szerint (A–Z)</option>
        </select>
      </div>

      <div className="mt-6 divide-y divide-ink-line overflow-hidden rounded-2xl border border-ink-line">
        {visibleProjects.length === 0 && (
          <p className="p-8 text-center text-mist">
            {projects.length === 0
              ? "No projects yet. Create one or sync from Notion."
              : "Nincs találat a keresésre."}
          </p>
        )}
        {visibleProjects.map((p) => (
          
            <a key={p.id}
            href={`/admin/${p.id}`}
            className="flex items-center gap-4 bg-ink-card px-5 py-4 transition hover:bg-white/[0.03]"
          >
            <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-soft">
              {p.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_image_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display text-lg text-bone">{p.title}</h3>
              <p className="truncate text-sm text-mist">
                {p.client_name}
                {p.project_date ? ` · ${p.project_date}` : ""}
              </p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mist">
              {p.status}
            </span>
            {p.has_password && (
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-ember">
                locked
              </span>
            )}
            <ExternalLink className="h-4 w-4 text-mist" />
            <button
              onClick={(e) => onDelete(e, p.id, p.title)}
              title="Projekt törlése"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist transition hover:bg-ember/10 hover:text-ember"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </a>
        ))}
      </div>
    </main>
  );
}
