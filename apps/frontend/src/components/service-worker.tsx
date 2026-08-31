"use client";

import { useEffect } from "react";

/** Registriert den Service Worker (nur in Produktion / über HTTPS bzw. localhost). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* still */
    });
  }, []);
  return null;
}
