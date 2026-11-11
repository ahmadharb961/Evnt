"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { scanTicketAction, type ScanResult } from "@/actions/merchant-bookings";
import { useT } from "@/i18n/client";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** Ticket check-in: camera scanning where the browser supports it, manual code entry everywhere. */
export function Scanner() {
  const t = useT();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [camera, setCamera] = useState(false);
  const [supported, setSupported] = useState(false);
  const [pending, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef({ code: "", at: 0 });

  useEffect(() => setSupported(typeof window !== "undefined" && "BarcodeDetector" in window), []);

  const check = (raw: string) =>
    start(async () => {
      setResult(await scanTicketAction(raw));
      setCode("");
    });

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const Det = (window as unknown as { BarcodeDetector: new (o: object) => Detector }).BarcodeDetector;
        const det = new Det({ formats: ["qr_code"] });
        const loop = async () => {
          if (stop || !video.current) return;
          const found = await det.detect(video.current).catch(() => []);
          const v = found[0]?.rawValue;
          if (v && (v !== last.current.code || Date.now() - last.current.at > 4000)) {
            last.current = { code: v, at: Date.now() };
            check(v);
          }
          setTimeout(loop, 350);
        };
        loop();
      } catch {
        setCamera(false);
        alert(t("Camera not available. Type the code instead."));
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  return (
    <div className="mx-auto max-w-md space-y-5">
      {supported && (
        <div className="overflow-hidden rounded-4xl bg-ink">
          {camera ? (
            <video ref={video} className="aspect-square w-full object-cover" playsInline muted />
          ) : (
            <button type="button" onClick={() => setCamera(true)} className="flex aspect-square w-full flex-col items-center justify-center gap-3 text-white">
              <Camera className="h-10 w-10" />
              {t("Start camera")}
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) check(code);
        }}
        className="flex gap-2"
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("Ticket code (8 characters)")} className="input font-mono uppercase" autoCapitalize="characters" />
        <button className="btn-primary" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Check")}
        </button>
      </form>
      {result && (
        <div className={`rounded-4xl p-6 text-center ${result.ok ? "bg-mint" : "bg-red-100"}`} role="status" aria-live="assertive">
          {result.ok ? <CheckCircle2 className="mx-auto h-12 w-12 text-mint-deep" /> : <XCircle className="mx-auto h-12 w-12 text-red-600" />}
          <p className="mt-3 text-xl font-bold">{result.message}</p>
          {result.detail && <p className="mt-1 text-sm">{result.detail}</p>}
          {result.payAtVenue && <p className="mt-3 rounded-2xl bg-white/70 p-2 text-sm font-semibold">{t("Pay at venue: collect payment and mark the booking as paid.")}</p>}
          {result.bookingCode && (
            <Link href={`/merchant/bookings/${result.bookingCode}`} className="mt-3 inline-block text-sm font-semibold underline">
              {t("Open booking")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
