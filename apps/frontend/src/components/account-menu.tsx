"use client";

import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/api";
import { applyThemePref, readThemePref, type ThemePref } from "@/lib/theme";
import styles from "./account-menu.module.css";

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "Auto" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState<ThemePref>("system");
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = readThemePref();
    setPref(stored);
    // Erzwungene Wahl → Browser-Chrome-Farbe direkt angleichen. "system"
    // behält die responsiven <meta>-Werte aus dem SSR.
    if (stored !== "system") applyThemePref(stored);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function chooseTheme(next: ThemePref) {
    setPref(next);
    applyThemePref(next);
  }

  async function logout() {
    setBusy(true);
    try {
      await apiPost("/auth/logout");
    } catch {
      /* Cookie ggf. schon weg */
    }
    window.location.assign("/login");
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Konto und Darstellung"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{initials(name)}</span>
      </button>

      {open ? (
        <div className={styles.panel} role="menu">
          <div className={styles.identity}>
            <span className={styles.name}>{name}</span>
            <span className={styles.email}>{email}</span>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel} id="theme-label">
              Darstellung
            </span>
            <div
              className={styles.segmented}
              role="radiogroup"
              aria-labelledby="theme-label"
            >
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={pref === opt.value}
                  className={styles.segment}
                  data-active={pref === opt.value}
                  onClick={() => chooseTheme(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={styles.logout}
            role="menuitem"
            disabled={busy}
            onClick={logout}
          >
            {busy ? "Abmelden…" : "Abmelden"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
