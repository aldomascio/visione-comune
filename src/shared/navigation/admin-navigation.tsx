"use client";

import {
  Building2,
  FileText,
  LayoutDashboard,
  Lightbulb,
  MapPinned,
  Newspaper,
  Send,
  Tags,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/ui";
import { adminNavigationItemClassName } from "./admin-navigation-styles";

type AdminNavigationProps = {
  compact?: boolean;
};

const adminNavItems: Array<{
  href: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
}> = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/admin/segnalazioni", icon: FileText, label: "Segnalazioni" },
  { href: "/admin/proposte", icon: Lightbulb, label: "Proposte" },
  { href: "/admin/trasmissioni", icon: Send, label: "Trasmissioni" },
  { href: "/admin/notizie", icon: Newspaper, label: "Notizie" },
  { href: "/admin/categorie", icon: Tags, label: "Categorie" },
  { href: "/admin/destinatari", icon: Building2, label: "Destinatari" },
  { href: "/admin/smistamento", icon: MapPinned, label: "Smistamento" }
];

export function AdminNavigation({ compact = false }: AdminNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione amministrativa"
      className={compact ? "flex gap-2 overflow-x-auto pb-1" : "grid gap-1"}
    >
      {adminNavItems.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              adminNavigationItemClassName,
              active
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                : undefined
            )}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
