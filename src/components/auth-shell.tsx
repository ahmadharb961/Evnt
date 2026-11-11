export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container-x flex min-h-[70vh] items-start justify-center gap-12 py-10 sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/family.webp" alt="" className="hidden aspect-[4/5] w-[44%] max-w-[520px] rounded-[2rem] object-cover shadow-lift lg:block" />
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
        </div>
        <div className="card p-6 sm:p-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function OAuthButtons({ next, label, or }: { next?: string; label: string; or: string }) {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  return (
    <>
      <a href={`/api/auth/google?next=${encodeURIComponent(next ?? "/account")}`} className="btn-outline w-full">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
        </svg>
        {label}
      </a>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-ink/10" />
        <span>{or}</span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>
    </>
  );
}
