import type { Metadata } from "next";
import Link from "next/link";
import { Button, Field, Input } from "@/shared/ui";

export const metadata: Metadata = {
  title: "Newsletter | Visione Comune",
  description: "Iscriviti alla newsletter di Visione Comune per ricevere aggiornamenti sul territorio, attività e nuovi contenuti."
};

export default function NewsletterPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground sm:px-8 sm:py-20 lg:px-12">
      <div className="mx-auto grid w-full max-w-xl gap-8">
        <header className="grid gap-3 text-center">
          <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">Non perderti gli aggiornamenti</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Ricevi periodicamente le novità di Visione Comune, le iniziative sul territorio e i contenuti che meritano di essere seguiti.
          </p>
        </header>

        <form className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <Field htmlFor="newsletter-name" label="Nome">
              <Input autoComplete="name" disabled id="newsletter-name" name="name" placeholder="Il tuo nome" required type="text" />
            </Field>

            <Field htmlFor="newsletter-email" label="Email">
              <Input autoComplete="email" disabled id="newsletter-email" name="email" placeholder="nome@esempio.it" required type="email" />
            </Field>

            <Button className="w-full disabled:opacity-100 sm:col-span-2 lg:col-span-1 lg:w-auto" disabled type="submit">Iscriviti</Button>
          </div>

          <label className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <input className="mt-0.5 size-4 shrink-0 accent-primary" disabled name="privacyConfirmation" required type="checkbox" />
            <span>
              Ho letto l’{" "}
              <Link className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-muted-foreground" href="/privacy">
                Informativa privacy
              </Link>{" "}
              e acconsento al trattamento dei dati per l’iscrizione alla newsletter.
            </span>
          </label>

        </form>
      </div>
    </main>
  );
}
