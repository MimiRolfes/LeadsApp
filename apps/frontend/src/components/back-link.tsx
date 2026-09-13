"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./back-link.module.css";

/**
 * Rücksprung-Zeile über dem Inhalt.
 *
 * Mit `href` ein normaler Link auf ein bekanntes Ziel, ohne `href` zurück
 * über den Browser-Verlauf (bei Direktaufruf oder geteiltem Link auf "/").
 */
export function BackLink({
  href,
  label = "Zurück",
  context,
}: {
  href?: string;
  label?: string;
  /** Ergänzender Text rechts daneben, z. B. der Eventname. */
  context?: string;
}) {
  const router = useRouter();

  const inner = (
    <>
      <span aria-hidden="true">←</span> {label}
    </>
  );

  return (
    <div className={styles.wrap}>
      {href ? (
        <Link href={href} className={styles.link}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            // Nur zurückspringen, wenn wir wirklich aus der eigenen App
            // kommen — sonst landet man auf einer fremden Seite.
            const eigenerVerlauf =
              window.history.length > 1 &&
              document.referrer &&
              new URL(document.referrer).origin === window.location.origin;
            if (eigenerVerlauf) router.back();
            else router.push("/");
          }}
        >
          {inner}
        </button>
      )}
      {context ? <span className={styles.context}>{context}</span> : null}
    </div>
  );
}

/** "Zurück" im Kopfbereich — auf der Event-Übersicht ausgeblendet. */
export function HeaderBack() {
  return usePathname() === "/" ? null : <BackLink />;
}
