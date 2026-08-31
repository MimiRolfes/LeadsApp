"use client";

import { usePathname } from "next/navigation";
import { BackLink } from "./back-link";

/** "Zurück" im Kopfbereich — auf der Event-Übersichtsseite ausgeblendet. */
export function HeaderBack() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <BackLink fallback="/" />;
}
