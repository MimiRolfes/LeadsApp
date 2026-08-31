"use client";

import { useRouter } from "next/navigation";
import styles from "./back-link.module.css";

/**
 * "Zurück"-Schaltfläche. Nutzt die Browser-History wenn möglich, sonst den
 * angegebenen Fallback-Pfad (z. B. bei Direktaufruf / geteiltem Link).
 */
export function BackLink({
  fallback = "/",
  label = "Zurück",
}: {
  fallback?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.back}
      onClick={() => {
        if (
          typeof window !== "undefined" &&
          window.history.length > 1 &&
          document.referrer &&
          new URL(document.referrer).origin === window.location.origin
        ) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
    >
      <span aria-hidden="true">←</span> {label}
    </button>
  );
}
