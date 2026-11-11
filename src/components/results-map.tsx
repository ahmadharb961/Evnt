"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { useT } from "@/i18n/client";

export type MapPoint = { id: string; lat: number; lng: number; title: string; subtitle: string; href: string; image: string };

/** OpenStreetMap map of results. Markers are simple pastel pins; a tap opens a small card linking to the listing. */
export function ResultsMap({ points, height = 520 }: { points: MapPoint[]; height?: number }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true }).setView([33.89, 35.5], 10);
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILES_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "© OpenStreetMap" }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#252525;transform:rotate(-45deg);border:3px solid #B3E2CD;box-shadow:0 4px 10px rgba(0,0,0,.25)"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
      const bounds: [number, number][] = [];
      for (const p of points) {
        bounds.push([p.lat, p.lng]);
        L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<a href="${esc(p.href)}" style="display:block;width:200px;color:#252525;text-decoration:none"><img src="${esc(p.image)}" style="width:100%;height:100px;object-fit:cover;border-radius:12px"/><b style="display:block;margin-top:6px">${esc(p.title)}</b><span style="font-size:12px;color:#767676">${esc(p.subtitle)}</span></a>`,
          );
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      else if (bounds.length === 1) map.setView(bounds[0], 13);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);
  if (!points.length) return <p className="rounded-3xl bg-canvas p-10 text-center text-ink-muted">{t("No results with a location to show on the map.")}</p>;
  return <div ref={ref} style={{ height }} className="z-0 overflow-hidden rounded-3xl border border-ink/10" />;
}
