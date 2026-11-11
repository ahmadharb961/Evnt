export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#252525" />
      <circle cx="24" cy="24" r="9" fill="#B3E2CD" />
      <circle cx="40" cy="24" r="9" fill="#FDCDAC" />
      <circle cx="24" cy="40" r="9" fill="#CBD5E8" />
      <circle cx="40" cy="40" r="9" fill="#F4CAE4" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} dir="ltr">
      <LogoMark />
      <span className="text-xl font-extrabold tracking-[.18em] text-ink">EVNT</span>
    </span>
  );
}
