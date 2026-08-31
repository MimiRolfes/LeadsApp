import Link from "next/link";
import styles from "./crumb.module.css";

/** Rücksprung-Zeile über der Abschnitts-Navigation. */
export function Crumb({
  href,
  label,
  context,
}: {
  href: string;
  label: string;
  context?: string;
}) {
  return (
    <div className={styles.crumb}>
      <Link href={href} className={styles.link}>
        <span aria-hidden="true">←</span> {label}
      </Link>
      {context ? <span className={styles.context}>{context}</span> : null}
    </div>
  );
}
