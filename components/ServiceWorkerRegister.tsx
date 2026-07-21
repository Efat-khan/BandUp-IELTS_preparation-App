"use client";

import { useEffect } from "react";

/** Registers the offline-shell service worker (public/sw.js). Silently no-ops where unsupported (SSR, older browsers). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a progressive enhancement — a failed registration must never block the app.
    });
  }, []);

  return null;
}
