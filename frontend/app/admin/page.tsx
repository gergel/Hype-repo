"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, ExternalLink, Trash2, LogOut } from "lucide-react";
import {
  adminLogin,
  listProjects,
  createProject,
  deleteProject,
  ProjectSummary,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(!!localStorage.getItem("hype_admin_token"));
  }, []);
  return authed ? (
    <Dashboard onLogout={() => setAuthed(false)} />
  ) : (
    <Login onIn={() => setAuthed(true)} />
  );
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
      setError("Hibás bejelentkezési adatok.");
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
          HYPE Productions
        </p>
        <h1 className="mt-2 font-display text-2xl text-bone">Admin bejelentkezés</h1>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-6 w-full rounded-full border border-ink-line bg-ink px-5 py-3 text-bone outline-none focus:border-ember/60"
        />
        <input
          type="password"
          placeholder="Jelszó"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-3 w-full rounded-full border border-ink-line bg-ink px-5 py-3 text-bone outline-none focus:border-ember/60"
        />
        {error && <p className="mt-3 text-sm text-ember">{error}</p>}
        <Button variant="ember" size="lg" className="mt-5 w-full" onClick={submit}>
          Bejelentkezés
        </Button>
      </motion.div>
    </main>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "name">("date_desc");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(
    null
  );

  async function refresh() {
    setProjects(await listProjects());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function doCreate() {
    if (!title) return;
    await createProject({ title, client_name: client, status: "live" });
    setTitle("");
    setClient("");
    setCreating(false);
    refresh();
  }

  function logout() {
    localStorage.removeItem("hype_admin_token");
    onLogout();
  }

  function onDelete(e: React.MouseEvent, id: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete({ id, title });
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await deleteProject(confirmDelete.id);
    setConfirmDelete(null);
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
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-eyebrow text-mist">
            HYPE Productions
          </p>
          <h1 className="mt-1 font-display text-3xl text-bone">Projektek</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ember" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4" />
            Új projekt
          </Button>
          <Button variant="ghost" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Kijelentkezés
          </Button>
        </div>
      </div>

      {creating && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-line bg-ink-card p-4">
          <input
            placeholder="Projekt címe"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full min-w-0 flex-1 rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60 sm:w-auto"
          />
          <input
            placeholder="Ügyfél neve"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="w-full min-w-0 flex-1 rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60 sm:w-auto"
          />
          <Button variant="primary" onClick={doCreate} className="w-full sm:w-auto">
            Létrehozás
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          placeholder="Keresés: projekt, ügyfél vagy dátum…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-w-0 flex-1 rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60 sm:w-auto"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="w-full rounded-full border border-ink-line bg-ink px-4 py-2.5 text-bone outline-none focus:border-ember/60 sm:w-auto"
        >
          <option value="date_desc">Dátum (legújabb elöl)</option>
          <option value="date_asc">Dátum (legrégebbi elöl)</option>
          <option value="name">Név (A–Z)</option>
        </select>
      </div>

      <div className="mt-6 divide-y divide-ink-line overflow-hidden rounded-2xl border border-ink-line">
        {visibleProjects.length === 0 && (
          <p className="p-8 text-center text-mist">
            {projects.length === 0
              ? "Még nincs projekt. Hozz létre egyet a kezdéshez."
              : "Nincs találat a keresésre."}
          </p>
        )}
        {visibleProjects.map((p) => (
          <a
            key={p.id}
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
                zárolt
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

      {/* Törlés megerősítő ablak */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm leading-relaxed text-bone">
              Biztosan törlöd a(z) &ldquo;{confirmDelete.title}&rdquo; projektet az összes
              videójával és képével együtt? Ez nem vonható vissza.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                Mégse
              </Button>
              <button
                onClick={doDelete}
                className="flex items-center gap-2 rounded-full border border-ember/40 px-4 py-2 text-sm text-ember transition hover:bg-ember/10"
              >
                Törlés
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
