import Link from "next/link";
import { Heart, ShoppingBag, User } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SearchBox } from "@/components/site/search-box";
import { NavLinks } from "@/components/site/nav-links";
import { getCurrentUser } from "@/server/auth";
import { cartCount } from "@/server/cart";
import { getT } from "@/i18n/server";

export async function SiteHeader() {
  const [user, count, t] = await Promise.all([getCurrentUser(), cartCount(), getT()]);
  const nav = [
    { href: "/discover", label: t("Discover") },
    { href: "/activities", label: t("Activities") },
    { href: "/birthdays", label: t("Birthdays") },
    { href: "/restaurants", label: t("Restaurants") },
    { href: "/shop", label: t("Shop") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-ink/[.06] bg-white/90 backdrop-blur-md">
      <div className="container-x flex h-16 items-center gap-3 lg:h-[72px] lg:gap-6">
        <Link href="/" aria-label="EVNT" className="shrink-0">
          <Logo />
        </Link>
        <NavLinks items={nav} />
        <div className="hidden flex-1 md:block lg:max-w-xs xl:max-w-sm">
          <SearchBox compact />
        </div>
        <div className="ms-auto flex items-center gap-0.5">
          <LanguageSwitcher />
          <Link href="/favorites" aria-label={t("Favorites")} className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5 lg:inline-flex">
            <Heart className="h-[19px] w-[19px]" />
          </Link>
          <Link href="/cart" aria-label={t("Cart")} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5">
            <ShoppingBag className="h-[19px] w-[19px]" />
            {count > 0 && (
              <span className="absolute end-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          <Link
            href={user ? "/account" : "/login"}
            className="ms-1 hidden h-10 items-center gap-2 rounded-full border border-ink/10 ps-1.5 pe-4 text-sm font-medium hover:border-ink/30 lg:inline-flex"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint-soft">
              <User className="h-4 w-4" />
            </span>
            {user ? user.name.split(" ")[0] : t("Sign in")}
          </Link>
        </div>
      </div>
      <div className="container-x pb-3 md:hidden">
        <SearchBox compact />
      </div>
    </header>
  );
}
