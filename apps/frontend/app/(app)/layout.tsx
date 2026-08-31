import type { ReactNode } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { LogoutButton } from "@/components/logout-button";
import styles from "./app-shell.module.css";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.logo}>
          humatter <span>Leads</span>
        </Link>
        <div className={styles.userArea}>
          <span className={styles.userName}>{user.displayName}</span>
          <LogoutButton />
        </div>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
