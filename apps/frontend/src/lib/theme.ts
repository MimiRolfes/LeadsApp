"use client";

/**
 * Hell/Dunkel-Umschaltung. `system` folgt dem Betriebssystem
 * (`prefers-color-scheme`), sonst erzwingt `data-theme` auf <html> die Wahl.
 * Die Präferenz liegt in localStorage; ein Inline-Skript in app/layout.tsx
 * wendet sie vor dem ersten Paint an (kein Flackern).
 */
export type ThemePref = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "hl-theme";

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* private mode / blockiert */
  }
  return "system";
}

/** Basis-Hintergrundfarben je Modus — muss zu globals.css passen. */
const BG_LIGHT = "#e0e3f3";
const BG_DARK = "#070a1c";

export function applyThemePref(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", pref);
  }

  // Browser-Chrome (Android-PWA) an die tatsächliche Darstellung anpassen.
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", dark ? BG_DARK : BG_LIGHT));

  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* egal — die Attribut-Änderung wirkt trotzdem für diese Sitzung */
  }
}
