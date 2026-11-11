"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyBookingAction } from "@/actions/booking";
import { useT } from "@/i18n/client";

export function CancelBookingButton({ code }: { code: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="btn-danger"
        onClick={() => {
          if (!window.confirm(t("Cancel this booking? Your spots will be released."))) return;
          start(async () => {
            const r = await cancelMyBookingAction(code, "Cancelled by parent");
            if (r?.error) setError(r.error);
            else router.refresh();
          });
        }}
      >
        {t("Cancel booking")}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </>
  );
}
