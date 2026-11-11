"use client";

import { useEffect, useState } from "react";
import { X, Share, SquarePlus, EllipsisVertical } from "lucide-react";
import { useT } from "@/i18n/client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "evnt_install_dismissed";
const SNOOZE_DAYS = 14;

function snoozed() {
  try {
    const v = Number(localStorage.getItem(KEY) || 0);
    return v && Date.now() - v < SNOOZE_DAYS * 86400_000;
  } catch {
    return false;
  }
}

/**
 * Asks mobile visitors to add EVNT to their home screen.
 * Android/Chrome: one-tap install via the browser prompt. iPhone/iPad Safari: short Share → Add to Home Screen steps.
 * Never shown inside the installed app, on desktop, or again for 14 days after "Not now".
 */
export function InstallPrompt() {
  const t = useT();
  const [mode, setMode] = useState<"android" | "ios" | "menu" | null>(null);
  const [evt, setEvt] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const mobile = window.matchMedia("(max-width: 1023px) and (pointer: coarse)").matches;
    if (standalone || !mobile || snoozed()) return;
    if (/^\/(admin|pay|checkout|cart\/checkout)/.test(location.pathname)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setTimeout(() => setMode("android"), 2500);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setMode(null);
    window.addEventListener("appinstalled", onInstalled);

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const safari = ios && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let got = false;
    window.addEventListener("beforeinstallprompt", () => (got = true), { once: true });
    if (safari) timer = setTimeout(() => setMode("ios"), 3000);
    // Android browsers without one-tap install (Samsung Internet, Firefox…): show the menu steps instead.
    else if (/Android/.test(ua)) timer = setTimeout(() => !got && setMode((m) => m ?? "menu"), 6000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
    };
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setMode(null);
  };

  if (!mode) return null;
  return (
    <div className="fixed inset-x-3 z-50 animate-rise-in lg:hidden" style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }} role="dialog" aria-label={t("Add EVNT to your home screen")}>
      <div className="rounded-3xl bg-white p-4 shadow-lift ring-1 ring-ink/[.06]">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("Add EVNT to your home screen")}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{t("Open it like an app — faster, full screen, one tap away.")}</p>
          </div>
          <button type="button" onClick={close} aria-label={t("Close")} className="-me-1 -mt-1 rounded-full p-1.5 text-ink-muted hover:bg-canvas">
            <X className="h-4 w-4" />
          </button>
        </div>
        {mode === "android" ? (
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={close} className="btn-ghost h-11 flex-1">
              {t("Not now")}
            </button>
            <button
              type="button"
              className="btn-primary h-11 flex-1"
              onClick={async () => {
                if (!evt) return close();
                await evt.prompt();
                const r = await evt.userChoice;
                if (r.outcome === "dismissed") close();
                else setMode(null);
              }}
            >
              {t("Install app")}
            </button>
          </div>
        ) : mode === "menu" ? (
          <ol className="mt-4 space-y-2 rounded-2xl bg-canvas p-3 text-sm">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold">1</span>
              <span className="flex flex-wrap items-center gap-1">
                {t("Open your browser menu")} <EllipsisVertical className="h-4 w-4" aria-hidden />
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold">2</span>
              <span className="flex flex-wrap items-center gap-1">
                {t("Choose")} <b>{t("Add to Home screen")}</b> {t("or")} <b>{t("Install app")}</b>
              </span>
            </li>
          </ol>
        ) : (
          <ol className="mt-4 space-y-2 rounded-2xl bg-canvas p-3 text-sm">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold">1</span>
              <span className="flex flex-wrap items-center gap-1">
                {t("Tap")} <Share className="h-4 w-4 text-[#007aff]" aria-label={t("Share")} /> {t("in the Safari toolbar")}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold">2</span>
              <span className="flex flex-wrap items-center gap-1">
                {t("Choose")} <SquarePlus className="h-4 w-4" aria-hidden /> <b>{t("Add to Home Screen")}</b>
              </span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
