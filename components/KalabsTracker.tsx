"use client";

import { useEffect } from "react";

/* Medición Kalabs: un view al entrar + un ping cada 25s a kalabs.dev.
   Activo = señal en los últimos 60s. Sin cookies de terceros, sin
   fingerprint: un id por pestaña en sessionStorage. Si el endpoint no
   responde, la app sigue igual. */
const ENDPOINT = "https://www.kalabs.dev/api/track";

export default function KalabsTracker() {
  useEffect(() => {
    let id = sessionStorage.getItem("kalabs-sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("kalabs-sid", id);
    }
    const mandar = (evento: "view" | "ping") => {
      const cuerpo = JSON.stringify({
        project: "viagrua",
        path: location.pathname,
        referrer: document.referrer.slice(0, 300),
        session: id,
        evento,
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([cuerpo], { type: "application/json" });
        navigator.sendBeacon(ENDPOINT, blob);
      } else {
        fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: cuerpo,
          keepalive: true,
        }).catch(() => {});
      }
    };
    mandar("view");
    const t = setInterval(() => mandar("ping"), 25_000);
    return () => clearInterval(t);
  }, []);
  return null;
}
