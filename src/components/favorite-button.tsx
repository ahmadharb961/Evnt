"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/actions/favorites";
import { useT } from "@/i18n/client";

export function FavoriteButton({ type, id, saved = false, variant = "overlay" }: { type: "event" | "restaurant" | "product"; id: string; saved?: boolean; variant?: "overlay" | "plain" }) {
  const t = useT();
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();
  const router = useRouter();
  const path = usePathname();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t("Remove from favorites") : t("Save to favorites")}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOn((v) => !v);
        start(async () => {
          const r = await toggleFavoriteAction(type, id);
          if ("needsLogin" in r) {
            setOn(false);
            router.push(`/login?next=${encodeURIComponent(path)}`);
          } else if ("saved" in r) setOn(!!r.saved);
        });
      }}
      className={
        variant === "overlay"
          ? "flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105"
          : "btn-outline h-11 w-11 !px-0"
      }
    >
      <Heart className={`h-[18px] w-[18px] transition ${on ? "animate-pop fill-[#e5679f] text-[#e5679f]" : "text-ink"}`} />
    </button>
  );
}
