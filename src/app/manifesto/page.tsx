import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manifesto | Visione Comune",
  description: "I principi, i temi e il metodo di lavoro che guidano Visione Comune."
};

const principles = [
  {
    number: "01",
    title: "Partecipazione",
    description: "Le persone devono poter contribuire in modo semplice e concreto."
  },
  {
    number: "02",
    title: "Territorio",
    description: "Partiamo dai problemi, dalle opportunità e dai bisogni reali della comunità."
  },
  {
    number: "03",
    title: "Responsabilità",
    description: "Ascoltare, approfondire e restituire aggiornamenti in modo trasparente."
  }
];

const themes = [
  "Salute",
  "Ambiente",
  "Cultura",
  "Sviluppo locale",
  "Giustizia sociale",
  "Partecipazione"
];

const workingMethod = ["Ascoltiamo", "Approfondiamo", "Agiamo", "Aggiorniamo"];

export default function ManifestoPage() {
  return (
    <main className="bg-background px-6 pb-20 pt-16 text-foreground sm:px-8 sm:pb-24 sm:pt-20 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-14 sm:gap-16">
        <header className="grid max-w-3xl gap-3">
          <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">Manifesto</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Principi, temi e metodo di Visione Comune.
          </p>
        </header>

        <section aria-labelledby="principles-title" className="grid gap-8">
          <h2 className="font-serif text-3xl font-semibold tracking-normal sm:text-4xl" id="principles-title">I nostri principi</h2>
          <div className="border-y border-border">
            {principles.map((principle) => (
              <article className="grid gap-3 border-b border-border py-6 last:border-b-0 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-8" key={principle.number}>
                <p className="font-serif text-5xl leading-none text-muted-foreground" aria-hidden="true">{principle.number}</p>
                <div className="grid max-w-3xl gap-2">
                  <h3 className="font-serif text-2xl font-semibold tracking-normal">{principle.title}</h3>
                  <p className="text-base leading-7 text-muted-foreground">{principle.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="themes-title" className="grid gap-8">
          <h2 className="font-serif text-3xl font-semibold tracking-normal sm:text-4xl" id="themes-title">I temi</h2>
          <ul className="grid border-y border-border sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <li className="border-b border-border py-4 text-sm font-medium last:border-b-0 sm:px-5 sm:first:pl-0 lg:[&:nth-child(3n+1)]:pl-0" key={theme}>
                {theme}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="method-title" className="grid gap-8">
          <h2 className="font-serif text-3xl font-semibold tracking-normal sm:text-4xl" id="method-title">Come lavoriamo</h2>
          <ol className="flex flex-col items-start gap-3 border-y border-border py-5 sm:flex-row sm:items-center sm:gap-4">
            {workingMethod.map((step, index) => (
              <li className="flex items-center gap-4 font-medium" key={step}>
                <span>{step}</span>
                {index < workingMethod.length - 1 ? <span aria-hidden="true" className="rotate-90 text-muted-foreground sm:rotate-0">→</span> : null}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="participate-title" className="grid gap-6 border-t border-border pt-10">
          <div className="grid max-w-2xl gap-3">
            <h2 className="font-serif text-3xl font-semibold tracking-normal sm:text-4xl" id="participate-title">Partecipa</h2>
            <p className="text-base leading-7 text-muted-foreground">
              Segnala un problema o condividi un’idea.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/segnala">
              Segnala un problema
            </Link>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/proponi">
              Proponi un’idea
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
