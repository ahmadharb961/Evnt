import { LoadingHold } from "@/components/nav-progress";

export default function Loading() {
  return (
    <div className="space-y-4 p-2" role="status" aria-busy="true">
      <LoadingHold />
      <div className="h-8 w-56 animate-pulse rounded-full bg-ink/[.08]" />
      <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((k) => <div key={k} className="h-24 animate-pulse rounded-3xl bg-ink/[.05]" />)}</div>
      <div className="h-64 animate-pulse rounded-3xl bg-ink/[.05]" />
    </div>
  );
}
