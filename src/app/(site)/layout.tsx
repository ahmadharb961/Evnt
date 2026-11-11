import { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { BottomNav } from "@/components/site/bottom-nav";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-nav flex min-h-dvh flex-col">
      <Suspense fallback={<div className="h-16 border-b border-ink/[.06]" />}>
        <SiteHeader />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}
