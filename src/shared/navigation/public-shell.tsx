"use client";

import Link from "next/link";
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
  { href: "/segnalazione", label: "Controlla segnalazione" },
  { href: "/privacy", label: "Privacy" }
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return children;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader pathname={pathname} />
      {children}
      <PublicFooter />
    </div>
  );
}

function PublicHeader({ pathname }: { pathname: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-8 lg:px-12">
      <nav aria-label="Navigazione principale" className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-3">
        <Link aria-label="Visione Comune - Home" className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/">
          <LogoMark className="h-14 w-14 lg:h-20 lg:w-20" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {publicNavItems.map((item) => (
            <PublicNavLink item={item} key={item.href} pathname={pathname} />
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/segnala"
          >
            Segnala un problema
          </Link>
        </div>

        <button
          aria-controls="mobile-public-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Chiudi menu principale" : "Apri menu principale"}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold lg:hidden"
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          {menuOpen ? "Chiudi" : "Menu"}
        </button>
      </nav>

      {menuOpen ? (
        <nav aria-label="Navigazione principale mobile" className="border-t border-border bg-background lg:hidden" id="mobile-public-navigation">
          <div className="mx-auto grid max-w-6xl gap-3 py-4">
            {publicNavItems.map((item) => (
              <PublicNavLink className="min-h-11 px-3 py-3" item={item} key={item.href} onClick={() => setMenuOpen(false)} pathname={pathname} />
            ))}
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/segnala"
              onClick={() => setMenuOpen(false)}
            >
              Segnala un problema
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function PublicNavLink({
  className,
  item,
  onClick,
  pathname
}: {
  className?: string;
  item: { href: string; label: string; exact?: boolean };
  onClick?: () => void;
  pathname: string;
}) {
  const active = isActivePath(pathname, item.href, item.exact);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
      className={cn("block bg-foreground", className)}
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
