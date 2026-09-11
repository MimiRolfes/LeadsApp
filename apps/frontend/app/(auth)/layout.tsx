import type { ReactNode } from "react";
import styles from "./auth.module.css";

/**
 * Auth-Shell (Login/Registrierung/Passwort) — Bildsprache aus Figma
 * ("Messe", node 37:113 u. a.): Lavendel-Fläche, zwei gerenderte
 * Marken-Formen, Glaskarte mit echter Wortmarke, kleines Logo unten links.
 * Art-Direction unterscheidet sich bewusst zwischen Handy/Desktop
 * (unterschiedliche Bildausschnitte, nicht nur skaliert) — daher `<picture>`.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.main}>
      <picture className={`${styles.shape} ${styles.shapeRaspberry}`}>
        <source
          media="(min-width: 56rem)"
          srcSet="/brand/auth-shape-raspberry-desktop.png"
        />
        <img
          src="/brand/auth-shape-raspberry-mobile.png"
          alt=""
          aria-hidden="true"
        />
      </picture>
      <picture className={`${styles.shape} ${styles.shapeSponge}`}>
        <source
          media="(min-width: 56rem)"
          srcSet="/brand/auth-shape-sponge-desktop.png"
        />
        <img
          src="/brand/auth-shape-sponge-mobile.png"
          alt=""
          aria-hidden="true"
        />
      </picture>

      <div className={styles.panel}>
        {/* eslint-disable-next-line @next/next/no-img-element -- statisches Markenlogo, next/image lohnt hier nicht */}
        <img
          src="/brand/humatter-wordmark.png"
          alt="humatter"
          className={styles.logo}
        />
        {children}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- statisches Deko-Icon */}
      <img
        src="/brand/humatter-mascot.png"
        alt=""
        aria-hidden="true"
        className={styles.mascot}
      />
    </main>
  );
}
