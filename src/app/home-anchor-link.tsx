"use client";

import type { MouseEvent, ReactNode } from "react";

export function HomeAnchorLink({ children, href }: { children: ReactNode; href: `#${string}` }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.querySelector(href);

    if (!target) {
      return;
    }

    event.preventDefault();
    window.history.pushState(null, "", href);
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  }

  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary-foreground/60 bg-transparent px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      href={href}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
