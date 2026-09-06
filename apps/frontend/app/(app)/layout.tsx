import type { ReactNode } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { AccountMenu } from "@/components/account-menu";
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
            <span className={styles.logoPrefix}>humatter </span>
            <span>Leads</span>
          </Link>
        </div>
        <div className={styles.userArea}>
          <SyncStatus />
          <AccountMenu name={user.displayName} email={user.email} />
        </div>
      </header>
      <main id="main" className={styles.content}>
        {children}
      </main>
    </div>
  );
}
