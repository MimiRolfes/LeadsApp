# docs/design-system.md — humatter Leads · Brand Foundation

Status: Brand-Token-Fundament (Phase 0). Wird in Phase 3 (frontend-agent) zu
einem vollständigen Komponenten-Designsystem ausgebaut.
Datum: 2026-08-31

## Herkunft & Geltung

Es existiert **kein App-Design in Figma**. Vorhanden ist nur die Marketing-/
Instagram-Asset-Datei „Humatter-Insta" (`figma.com/design/aTefbNYHYn4gfUZoKa7UgW`,
Seite „Rohmaterial"): Logo, Sprüche, Illustrationen, Post-Layouts.

Auf ausdrückliche Freigabe (2026-08-31) wird die App-UI **auf Basis der daraus
extrahierten Marken-Merkmale** gestaltet. Die folgenden Rohwerte stammen direkt
aus Figma-Nodes dieser Datei; alles darüber hinaus (Komponenten, Zustände,
Dichte, Interaktions-Pattern) ist bewusste Designarbeit fürs Produkt und **nicht**
aus Figma abgeleitet.

## Rohwerte aus Figma

| Merkmal | Wert | Figma-Quelle |
| --- | --- | --- |
| Marken-Dunkelblau (Text/Headlines) | `#001540` | Node `2:18`, Figma-Variable „dunkel-blau" |
| Dunkelblau-Variante | `#0b1444` | Node `1:73` (Catch Phrases) |
| Akzent-Blau (Betonung, Links) | `#0c6cfd` | Node `2:18` (`wo`, `aufhören`) |
| Lavendel / Periwinkle (Flächen) | `#c5cdf7` | Node `1:80` Hintergrund |
| Weiß | `#ffffff` | diverse |
| Display-Schrift | **Inria Serif** (400/700) | Node `2:18` |
| UI-/Body-Schrift | **Inter** (400) | Node `1:73` |
| Headline-Duktus | Versalien, leicht gesperrt | „HUMANS. TEAMS. MATTER." u. a. |
| Formsprache | weiche, organische Ellipsen/„Blobs" in Lavendel-Tönen | Illustrationsrahmen |
| Logo | „w"-Krone + Wortmarke „humatter" + Tagline-Lockup | Node `1:6`, `1:25` |

Beide Schriften sind über Google Fonts verfügbar und werden via `next/font`
selbst gehostet (kein externer Font-CDN-Request zur Laufzeit).

## Ableitung für die App (Designentscheidungen)

Die Instagram-Marke ist flächig-lavendel und serif-lastig. Für ein
**mobile-first Erfassungswerkzeug mit dichten Formularen und Tabellen** ist das
nur teilweise tragfähig. Entscheidungen:

- **Inter** ist die dominierende Schrift (UI, Formulare, Listen, Dashboard).
  **Inria Serif** nur für große Seiten-/Bereichs-Headlines und Marketing-nahe
  Flächen (Login-Hero). Begründung: Lesbarkeit, Ziffern in Tabellen, a11y.
- **Lavendel `#c5cdf7`** ist zu gesättigt für große App-Flächen → nur als
  Akzent/Hero/Illustrationshintergrund. App-Hintergrund: neutrale helle Skala
  (`--neutral-50` `#f6f7fb`), Flächen weiß.
- **Akzent-Blau `#0c6cfd`** = primäre Aktion / Fokus / Links. Hover-Wert
  abgedunkelt (`#0a58d0`) für ausreichenden Kontrast auf Weiß.
- **Dunkelblau `#001540`** = Textfarbe (Light), Theme-Color, Headlines.
- Vollständige Neutral- und Statusskala in `app/globals.css` ergänzt (nicht aus
  Figma — Standard-Produkt-Palette, an den Marken-Blaustich angelehnt).

## Token-Referenz

Alle Tokens leben als CSS-Custom-Properties in
[`app/globals.css`](../app/globals.css):

- Farben: `--brand-*`, `--neutral-*`, `--status-*`, semantische Rollen
  `--color-bg|surface|border|text|text-muted|accent|accent-hover|focus-ring`
- Typografie: `--font-ui`, `--font-display`, `--text-xs … --text-3xl`,
  `--leading-tight|normal`
- Spacing: `--space-1 … --space-12` (4px-Basis)
- Radius: `--radius-sm|md|lg|pill`
- Touch: `--touch-min` = 44px (MASTER_PROMPT §3, einhändige Bedienung)
- Elevation: `--shadow-sm|md`

Dark Mode: semantische Rollen werden unter `@media (prefers-color-scheme: dark)`
und `[data-theme="dark"]` neu belegt.

## Offen für Phase 3

- Icon-Set (aus Marke ableiten oder lizenzfreies Set wählen — Entscheidung
  dokumentieren)
- App-Icons / Maskable Icons / Splash für PWA-Manifest
- Komponenten-Inventar: Button, Field, Select, Chip/Tag, Card, ListRow,
  StatusBadge (offline/pending/syncing/failed/synced), EmptyState, Toast,
  Dialog, Stepper (Capture-Flow)
- Verbindliche Kontrast-Checks (WCAG 2.2 AA) je Token-Paar
- Freigabe der abgeleiteten Richtung durch die Auftraggeberin
