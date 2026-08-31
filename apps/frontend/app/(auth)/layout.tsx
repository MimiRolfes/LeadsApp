import type { ReactNode } from "react";
import styles from "./auth.module.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.main}>
      <div className={styles.panel}>
        <p className={styles.brand}>humatter Leads</p>
        {children}
      </div>
    </main>
  );
}
