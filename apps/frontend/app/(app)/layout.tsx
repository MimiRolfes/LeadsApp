import type { ReactNode } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { LogoutButton } from "@/components/logout-button";
import { SyncStatus } from "@/components/sync-status";
import { HeaderBack } from "@/components/header-back";
import styles from "./app-shell.module.css";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Zum Inhalt springen
      </a>
      <header className={styles.topbar}>
        <div className={styles.brandArea}>
          <HeaderBack />
          <Link href="/" className={styles.logo}>
            humatter <span>Leads</span>
          </Link>
        </div>
        <div className={styles.userArea}>
          <SyncStatus />
          <span className={styles.userName}>{user.displayName}</span>
          <LogoutButton />
        </div>
      </header>
      <main id="main" className={styles.content}>
        {children}
      </main>
    </div>
  );
}
