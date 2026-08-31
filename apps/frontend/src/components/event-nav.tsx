"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./event-nav.module.css";

/**
 * Abschnitts-Navigation innerhalb eines Events. Immer sichtbar, damit man
 * von jeder Unterseite (Lead-Liste, Follow-ups, …) direkt zu den anderen
 * Bereichen oder zurück zur Übersicht wechseln kann.
 */
export function EventNav({
  eventId,
  isManager,
}: {
  eventId: string;
  isManager: boolean;
}) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  const tabs: { href: string; label: string; exact?: boolean }[] = [
    { href: base, label: "Übersicht", exact: true },
    { href: `${base}/capture`, label: "Erfassen" },
    { href: `${base}/leads`, label: "Leads" },
    { href: `${base}/followups`, label: "Follow-ups" },
  ];
  if (isManager) {
    tabs.push(
      { href: `${base}/team`, label: "Team" },
      { href: `${base}/questions`, label: "Fragenkatalog" },
      { href: `${base}/export`, label: "Export" },
      { href: `${base}/settings`, label: "Einstellungen" },
    );
  }

  return (
    <nav className={styles.nav} aria-label="Event-Bereiche">
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={styles.tab}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
