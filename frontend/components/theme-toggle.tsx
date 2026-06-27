"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Téma-kapcsoló a portálhoz.
 * - Alapból VILÁGOS (ha nincs korábbi választás).
 * - A választást localStorage jegyzi meg ("hype_portal_theme").
 * - A .dark osztályt a megadott cél-elemre teszi (alapból a <html>),
 *   így a Tailwind class-alapú dark módja működik.
 *
 * Fontos: az admin oldal a saját layoutjában FIXEN .dark, ezért
 * a portál világos/sötét állása az admin színeit nem befolyásolja.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hype_portal_theme");
    const isDark = saved === "dark"; // alapból világos, ha nincs mentve
    setDark(isDark);
    applyTheme(isDark);
    setMounted(true);
  }, []);

  function applyTheme(isDark: boolean) {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }

  function toggle() {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    localStorage.setItem("hype_portal_theme", next ? "dark" : "light");
  }

  // A szerver-oldali render ne villantson rossz ikont
  if (!mounted) {
    return <div className="h-10 w-10" aria-hidden="true" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Váltás világos témára" : "Váltás sötét témára"}
      title={dark ? "Világos téma" : "Sötét téma"}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-line bg-ink-card text-bone transition hover:border-ember/60"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
