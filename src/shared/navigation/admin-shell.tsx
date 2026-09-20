import { LogOut, UserRound } from "lucide-react";
import { adminLogoutAction } from "@/app/admin/actions";
import { cn } from "@/shared/ui";
import { AdminNavigation } from "./admin-navigation";
import { adminNavigationItemClassName } from "./admin-navigation-styles";
import { AdminMobileHeader } from "./admin-mobile-header";

export function AdminShell({
  activeAdminEmail,
  children
}: {
  activeAdminEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-border bg-background p-5 lg:flex">
        <div className="mb-8 flex w-fit items-center gap-3">
          <span aria-hidden="true" className="admin-brand-logo size-12" />
          <span className="text-sm font-semibold">Area amministrativa</span>
        </div>

        <AdminNavigation />

        <div className="mt-auto grid gap-3 border-t border-border pt-5">
          <div className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
            <UserRound aria-hidden="true" className="size-5 shrink-0" />
            <span className="truncate" title={activeAdminEmail}>{activeAdminEmail}</span>
          </div>
          <form action={adminLogoutAction} className="grid">
            <button
              className={cn(
                adminNavigationItemClassName,
                "cursor-pointer appearance-none justify-start border-0 bg-transparent"
              )}
              type="submit"
            >
              <LogOut aria-hidden="true" className="size-4 shrink-0" />
              Esci
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <AdminMobileHeader activeAdminEmail={activeAdminEmail} />

        <div className="admin-shell-content">{children}</div>
      </div>
    </div>
  );
}
