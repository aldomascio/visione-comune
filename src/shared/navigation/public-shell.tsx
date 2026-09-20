"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/shared/ui";

const publicNavItems = [
  { href: "/mappa", label: "Mappa" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/notizie", label: "Notizie" },
  { href: "/newsletter", label: "Newsletter" }
];

const footerLinks = [
  { href: "/mappa", label: "Mappa" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/notizie", label: "Notizie" },
  { href: "/newsletter", label: "Newsletter" },
  { href: "/proponi", label: "Proponi un’idea" },
  { href: "/segnalazione", label: "Controlla segnalazione" },
  { href: "/privacy", label: "Privacy" }
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return children;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {isTaskRoute(pathname) ? null : <PublicHeader pathname={pathname} />}
      {children}
      {isTaskRoute(pathname) ? null : <PublicFooter />}
    </div>
  );
}

function isTaskRoute(pathname: string) {
  return pathname === "/segnala" || pathname === "/proponi";
}

function PublicHeader({ pathname }: { pathname: string }) {
  const onHomeHero = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);

  function openMenu() {
    setMenuClosing(false);
    setMenuOpen(true);
  }

  function closeMenu() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMenuOpen(false);
      return;
    }
    setMenuClosing(true);
  }

  function finishClosingMenu() {
    if (menuClosing) {
      setMenuOpen(false);
      setMenuClosing(false);
    }
  }
  return (
    <>
      <header className={cn("z-40 px-6 transition-colors sm:px-8 lg:px-12", onHomeHero ? "absolute inset-x-0 top-0 bg-transparent text-primary-foreground" : "sticky top-0 border-b border-border bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80")}>
        <nav aria-label="Navigazione principale" className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-3">
        <Link aria-label="Visione Comune - Home" className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/">
          <LogoMark className="h-14 w-14 lg:h-20 lg:w-20" />
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {publicNavItems.map((item) => (
            <PublicNavLink className="text-sm font-semibold" item={item} key={item.href} onHero={onHomeHero} pathname={pathname} />
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/segnala"
          >
            Segnala
          </Link>
        </div>

        <button
          aria-controls="mobile-public-navigation"
          aria-expanded={menuOpen && !menuClosing}
          aria-label="Apri menu principale"
          className="inline-flex items-center justify-center text-current lg:hidden"
          onClick={openMenu}
          type="button"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        </nav>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 top-0 z-50 lg:hidden">
          <button aria-label="Chiudi menu principale" className={cn(menuClosing ? "mobile-drawer-backdrop-exit" : "mobile-drawer-backdrop", "absolute inset-0 h-full w-full bg-foreground/20")} onClick={closeMenu} type="button" />
          <aside className={cn(menuClosing ? "mobile-drawer-panel-exit" : "mobile-drawer-panel", "absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-border bg-background p-6 shadow-xl")} id="mobile-public-navigation" onAnimationEnd={finishClosingMenu}>
            <div className="-mx-6 -mt-6 mb-4 flex h-20 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
              <span className="text-base font-semibold">Navigazione</span>
              <button aria-label="Chiudi menu principale" className="inline-flex items-center justify-center text-foreground" onClick={closeMenu} type="button">
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <nav aria-label="Navigazione principale mobile" className="grid gap-2">
            {publicNavItems.map((item) => (
              <PublicNavLink className="min-h-11 text-base font-normal" item={item} key={item.href} onClick={closeMenu} pathname={pathname} />
            ))}
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/segnala"
              onClick={closeMenu}
            >
              Segnala un problema
            </Link>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function PublicNavLink({
  className,
  item,
  onClick,
  onHero = false,
  pathname
}: {
  className?: string;
  item: { href: string; label: string; exact?: boolean };
  onClick?: () => void;
  onHero?: boolean;
  pathname: string;
}) {
  const active = isActivePath(pathname, item.href, item.exact);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        onHero ? "text-primary-foreground/80 hover:text-primary-foreground" : active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className
      )}
      href={item.href}
      onClick={onClick}
    >
      {item.label}
    </Link>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/30 px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="grid gap-3">
          <LogoMark className="h-14 w-14" />
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            Piattaforma civica per segnalazioni, consultazione pubblica e dialogo operativo con gli enti.
          </p>
        </div>

        <nav aria-label="Link principali footer" className="grid gap-2 text-sm">
          <p className="font-semibold">Navigazione</p>
          {footerLinks.map((link) => (
            <Link className="text-muted-foreground hover:text-primary hover:underline" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="grid content-start gap-2 text-sm">
          <p className="font-semibold">Contatti</p>
          <p className="leading-6 text-muted-foreground">
            Area contatti in preparazione. Per ora usa i canali pubblici di Visione Comune.
          </p>
        </div>
      </div>
    </footer>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block bg-current", className)}
      style={{
        WebkitMask: "url('/logo.svg') center / contain no-repeat",
        mask: "url('/logo.svg') center / contain no-repeat"
      }}
    />
  );
}

function isActivePath(pathname: string, href: string, exact = false): boolean {
  if (exact) {
    return pathname === href;
  }

  if (href === "/segnalazione") {
    return pathname === "/segnalazione" || pathname.startsWith("/segnalazioni/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
