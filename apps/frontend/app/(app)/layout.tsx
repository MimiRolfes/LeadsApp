import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { HeaderBack } from "@/components/back-link";
import { SyncStatus } from "@/components/sync-status";
import styles from "./app-shell.module.css";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Zum Inhalt springen
      </a>
      <AppNav name={user.displayName} email={user.email} />

      <main id="main" className={styles.content}>
        {/* Rendert auf "/" nichts — nur Unterseiten bekommen "Zurück". */}
        <HeaderBack />
        {children}
      </main>

      <div className={styles.sync}>
        <SyncStatus />
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- statisches Deko-Icon */}
      <img
        src="/brand/humatter-mascot.png"
        alt=""
        aria-hidden="true"
        className={styles.mascot}
      />
    </div>
  );
}
