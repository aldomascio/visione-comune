"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/ui";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/segnalazioni", label: "Segnalazioni" },
  { href: "/admin/categorie", label: "Categorie" },
  { href: "/admin/destinatari", label: "Destinatari" },
  { href: "/admin/smistamento", label: "Smistamento" }
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigazione amministrativa" className="flex gap-2 overflow-x-auto pb-1">
      {adminNavItems.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
