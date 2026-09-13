import Link from "next/link";
import { adminLogoutAction } from "@/app/admin/actions";
import { Button } from "@/shared/ui";
import { AdminNavigation } from "./admin-navigation";

export function AdminShell({
  activeAdminEmail,
  children
}: {
  activeAdminEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 px-6 py-4 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link aria-label="Visione Comune admin - Dashboard" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/admin">
                <span
                  aria-hidden="true"
                  className="block h-14 w-14 bg-foreground"
                  style={{
                    WebkitMask: "url('/logo.svg') center / contain no-repeat",
                    mask: "url('/logo.svg') center / contain no-repeat"
                  }}
                />
              </Link>
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Area amministrativa</span>
            </div>
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center">
              <span className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
                {activeAdminEmail}
              </span>
              <form action={adminLogoutAction}>
                <Button type="submit" variant="secondary">
                  Esci
                </Button>
              </form>
            </div>
          </div>
          <AdminNavigation />
        </div>
      </header>
      {children}
    </div>
  );
}
