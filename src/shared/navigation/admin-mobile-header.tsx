"use client";

import { LogOut, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";
import { adminLogoutAction } from "@/app/admin/actions";
import { Button } from "@/shared/ui";
import { AdminNavigation } from "./admin-navigation";

export function AdminMobileHeader({ activeAdminEmail }: { activeAdminEmail: string }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  function openDrawer() {
    setClosing(false);
    setOpen(true);
  }

  function closeDrawer() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
  }

  function finishClosingDrawer() {
    if (closing) {
      setOpen(false);
      setClosing(false);
    }
  }

  return (
    <>
      <header className="border-b border-border bg-background px-6 py-4 sm:px-8 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="admin-brand-logo size-10" />
            <span className="text-sm font-semibold">Area amministrativa</span>
          </div>
          <button aria-controls="mobile-admin-navigation" aria-expanded={open && !closing} aria-label="Apri menu amministrativo" className="inline-flex items-center justify-center text-foreground" onClick={openDrawer} type="button">
            <Menu aria-hidden="true" className="size-5" />
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button aria-label="Chiudi menu amministrativo" className={`${closing ? "mobile-drawer-backdrop-exit" : "mobile-drawer-backdrop"} absolute inset-0 h-full w-full bg-foreground/20`} onClick={closeDrawer} type="button" />
          <aside className={`${closing ? "mobile-drawer-panel-exit" : "mobile-drawer-panel"} absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-border bg-background p-6 shadow-xl`} id="mobile-admin-navigation" onAnimationEnd={finishClosingDrawer}>
            <div className="-mx-6 -mt-6 mb-4 flex h-20 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
              <span className="text-base font-semibold">Navigazione</span>
              <button aria-label="Chiudi menu amministrativo" className="inline-flex items-center justify-center text-foreground" onClick={closeDrawer} type="button">
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div onClick={closeDrawer}><AdminNavigation /></div>
            <div className="mt-auto grid gap-4 border-t border-border pt-5">
              <div className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
                <UserRound aria-hidden="true" className="size-5 shrink-0" />
                <span className="truncate" title={activeAdminEmail}>{activeAdminEmail}</span>
              </div>
              <form action={adminLogoutAction}>
                <Button className="w-full justify-start" type="submit" variant="ghost"><LogOut aria-hidden="true" className="size-4" />Esci</Button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
