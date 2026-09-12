"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { applyThemePref, readThemePref, type ThemePref } from "@/lib/theme";
import {
  IconAccountCircle,
  IconCheckBox,
  IconGroups,
  IconMail,
  IconToday,
} from "./icons";
import styles from "./app-nav.module.css";

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "Auto" },
];

/**
 * Navigationsleiste aus dem Figma-Entwurf (Home-Frames 50:60 / 35:34).
 * Desktop: schwebende Pille oben mit Wortmarke in der Mitte.
 * Handy: gleiche Pille am unteren Rand, ohne Wortmarke.
 *
 * Die mittleren drei Icons stehen im Entwurf ohne Ziel — die zugehörigen
 * Bereiche gibt es in der App noch nicht, sie sind deshalb deaktiviert
 * statt auf eine falsche Route zu zeigen.
 */
export function AppNav({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState<ThemePref>("system");
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = readThemePref();
    setPref(stored);
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
      /* Cookie ggf. schon abgelaufen */
    }
    window.location.assign("/login");
  }

  return (
    <nav className={styles.nav} aria-label="Hauptnavigation">
      <div className={styles.group}>
        <Link href="/" className={styles.item} aria-label="Events">
          <IconToday className={styles.icon} />
        </Link>
        <button
          type="button"
          className={styles.item}
          disabled
          title="Noch nicht verfügbar"
          aria-label="Team (noch nicht verfügbar)"
        >
          <IconGroups className={styles.icon} />
        </button>
        <button
          type="button"
          className={styles.item}
          disabled
          title="Noch nicht verfügbar"
          aria-label="Nachrichten (noch nicht verfügbar)"
        >
          <IconMail className={styles.icon} />
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- statische Wortmarke */}
      <img
        src="/brand/humatter-wordmark.png"
        alt="humatter"
        className={`${styles.wordmark} ${styles.wordmarkLight}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- statische Wortmarke */}
      <img
        src="/brand/humatter-wordmark-light.png"
        alt=""
        aria-hidden="true"
        className={`${styles.wordmark} ${styles.wordmarkDark}`}
      />

      <div className={styles.group}>
        <button
          type="button"
          className={styles.item}
          disabled
          title="Noch nicht verfügbar"
          aria-label="Aufgaben (noch nicht verfügbar)"
        >
          <IconCheckBox className={styles.icon} />
        </button>

        <div className={styles.accountWrap} ref={wrapRef}>
          <button
            type="button"
            className={styles.item}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Konto und Darstellung"
            onClick={() => setOpen((v) => !v)}
          >
            <IconAccountCircle className={styles.icon} />
          </button>

          {open ? (
            <div className={styles.menu} role="menu">
              <p className={styles.menuName}>{name}</p>
              <p className={styles.menuMail}>{email}</p>

              <p className={styles.menuLabel} id="theme-label">
                Darstellung
              </p>
              <div
                className={styles.themeRow}
                role="group"
                aria-labelledby="theme-label"
              >
                {THEME_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={styles.themeButton}
                    aria-pressed={pref === o.value}
                    onClick={() => chooseTheme(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={styles.logout}
                onClick={logout}
                disabled={busy}
              >
                {busy ? "…" : "Abmelden"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
