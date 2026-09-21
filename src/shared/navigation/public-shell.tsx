"use client";

import Link from "next/link";
import { Mail, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaFacebookF, FaInstagram, FaTiktok } from "react-icons/fa6";
import type { PublicContactKind, PublicContactLink } from "@/shared/config/public-contact";
import { cn } from "@/shared/ui";

const publicNavItems = [
  { href: "/mappa", label: "Mappa" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/notizie", label: "Notizie" },
  { href: "/newsletter", label: "Newsletter" }
];

const footerParticipationLinks = [
  { href: "/segnala", label: "Segnala un problema" },
  { href: "/mappa", label: "Guarda la mappa" },
  { href: "/segnalazione", label: "Controlla una segnalazione" },
  { href: "/proponi", label: "Proponi un’idea" }
];

const footerInformationLinks = [
  { href: "/notizie", label: "Notizie" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/newsletter", label: "Newsletter" }
];

const footerLegalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/accessibilita", label: "Accessibilità" },
  { href: "/termini", label: "Termini e condizioni" }
];

const footerLinkClassName = "text-primary-foreground/70 no-underline transition-colors hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground";

export function PublicShell({ children, contactLinks }: { children: React.ReactNode; contactLinks: PublicContactLink[] }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return children;
  }

  return (
    <div className="public-shell flex min-h-screen flex-col bg-background text-foreground">
      {isTaskRoute(pathname) ? null : (
        <>
          <PublicHeader key={pathname} pathname={pathname} />
          {pathname === "/" ? null : <div aria-hidden="true" className="public-header-spacer h-20 shrink-0 lg:h-26" />}
        </>
      )}
      {children}
      {isTaskRoute(pathname) ? null : <PublicFooter contactLinks={contactLinks} />}
    </div>
  );
}

function isTaskRoute(pathname: string) {
  return pathname === "/segnala" || pathname === "/proponi";
}

function PublicHeader({ pathname }: { pathname: string }) {
  const onHome = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [homeHeaderActivated, setHomeHeaderActivated] = useState(false);
  const homeHeaderActivatedRef = useRef(false);
  const previousScrollY = useRef(0);

  useEffect(() => {
    previousScrollY.current = window.scrollY;

    let frame: number | null = null;

    function updateHeaderVisibility() {
      const currentScrollY = Math.max(window.scrollY, 0);
      const scrollDifference = currentScrollY - previousScrollY.current;

      if (currentScrollY === 0) {
        homeHeaderActivatedRef.current = false;
        setHomeHeaderActivated(false);
        setHeaderVisible(true);
      } else if (menuOpen) {
        setHeaderVisible(true);
      } else if (scrollDifference < 0) {
        if (onHome && !homeHeaderActivatedRef.current) {
          homeHeaderActivatedRef.current = true;
          setHomeHeaderActivated(true);
        }
        setHeaderVisible(true);
      } else if (scrollDifference > 0 && (!onHome || homeHeaderActivatedRef.current)) {
        setHeaderVisible(false);
      }

      previousScrollY.current = currentScrollY;
      frame = null;
    }

    function handleScroll() {
      if (frame === null) frame = window.requestAnimationFrame(updateHeaderVisibility);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    frame = window.requestAnimationFrame(updateHeaderVisibility);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [menuOpen, onHome]);

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
      <header
        className={cn(
          "public-header inset-x-0 top-0 z-40 px-6 transition-[transform,background-color,color,border-color] duration-300 ease-out motion-reduce:transition-none sm:px-8 lg:px-12",
          onHome && !homeHeaderActivated
            ? "absolute border-b border-transparent bg-transparent text-primary-foreground"
            : "fixed border-b border-border bg-background text-foreground",
          onHome && !homeHeaderActivated || headerVisible || menuOpen ? "translate-y-0" : "-translate-y-full"
        )}
        onFocusCapture={() => setHeaderVisible(true)}
      >
        <nav aria-label="Navigazione principale" className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 lg:h-26">
        <Link aria-label="Visione Comune - Home" className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/">
          <LogoMark className="h-14 w-14 lg:h-20 lg:w-20" />
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {publicNavItems.map((item) => (
            <PublicNavLink className="text-sm font-semibold" item={item} key={item.href} onHero={onHome && !homeHeaderActivated} pathname={pathname} />
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

function PublicFooter({ contactLinks }: { contactLinks: PublicContactLink[] }) {
  return (
    <footer className="public-footer pt-10">
      <div aria-hidden="true" className="public-footer-divider" />
      <div className="relative z-10 px-6 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="grid content-start gap-3">
            <Link aria-label="Visione Comune - Home" className="w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground" href="/">
              <LogoMark className="h-14 w-14 lg:h-20 lg:w-20" />
            </Link>
            <p className="max-w-sm text-sm leading-6 text-primary-foreground/70">
              Uno spazio per partecipare, segnalare e proporre idee per il territorio.
            </p>
            {contactLinks.length > 0 ? (
              <nav aria-label="Contatti e canali social" className="flex flex-wrap items-center gap-1">
                {contactLinks.map((link) => (
                  <a
                    aria-label={link.label}
                    className="inline-flex size-10 items-center justify-center text-primary-foreground/70 transition-colors hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                    href={link.href}
                    key={link.kind}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    target={link.external ? "_blank" : undefined}
                  >
                    <FooterContactIcon kind={link.kind} />
                  </a>
                ))}
              </nav>
            ) : null}
          </div>

          <nav aria-label="Partecipa" className="grid content-start gap-2 text-sm">
            <p className="font-semibold">Partecipa</p>
            {footerParticipationLinks.map((link) => (
              <Link className={footerLinkClassName} href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>

          <FooterLinkGroup ariaLabel="Informati" links={footerInformationLinks} title="Informati" />
          <FooterLinkGroup ariaLabel="Link legali" links={footerLegalLinks} title="Legale" />
        </div>
      </div>
      <div className="relative z-10 mt-8 border-t border-footer-border">
        <div className="px-6 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-6xl flex-col justify-center gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-primary-foreground/60">© 2026 Visione Comune. Tutti i diritti riservati.</p>
            <Link className={cn(footerLinkClassName, "w-fit text-sm")} href="/cookie-policy#gestisci-preferenze">
              Gestisci preferenze cookie
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({ ariaLabel, links, title }: { ariaLabel: string; links: Array<{ href: string; label: string }>; title: string }) {
  return (
    <nav aria-label={ariaLabel} className="grid content-start gap-2 text-sm">
      <p className="font-semibold">{title}</p>
      {links.map((link) => (
        <Link className={footerLinkClassName} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function FooterContactIcon({ kind }: { kind: PublicContactKind }) {
  if (kind === "facebook") return <FaFacebookF aria-hidden="true" className="size-5" />;
  if (kind === "instagram") return <FaInstagram aria-hidden="true" className="size-5" />;
  if (kind === "tiktok") return <FaTiktok aria-hidden="true" className="size-5" />;
  return <Mail aria-hidden="true" className="size-5" />;
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
