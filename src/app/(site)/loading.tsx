/** Shown instantly when moving between pages, while the new page loads. */
export default function Loading() {
  const card = (k: number) => (
    <div key={k} className="w-[78vw] max-w-[300px] shrink-0 overflow-hidden rounded-3xl border border-ink/[.07] bg-white sm:w-[280px]">
      <div className="aspect-[4/3] animate-pulse bg-ink/[.06]" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-ink/[.06]" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-ink/[.08]" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-ink/[.06]" />
      </div>
    </div>
  );
  return (
    <div className="container-x py-8" role="status" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-full bg-ink/[.08]" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-full bg-ink/[.06]" />
      <div className="mt-8 flex gap-4 overflow-hidden">{[0, 1, 2, 3].map(card)}</div>
      <div className="mt-10 h-6 w-44 animate-pulse rounded-full bg-ink/[.08]" />
      <div className="mt-5 flex gap-4 overflow-hidden">{[4, 5, 6, 7].map(card)}</div>
    </div>
  );
}
