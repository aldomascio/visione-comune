import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manifesto | Visione Comune",
  description: "I principi, i temi e il metodo di lavoro che guidano Visione Comune."
};

const principles = [
  {
    number: "01",
    title: "Partecipazione",
    description: "Crediamo nel valore delle persone e nella forza del confronto. Una comunità più consapevole costruisce decisioni migliori."
  },
  {
    number: "02",
    title: "Territorio",
    description: "Partiamo dai bisogni, dalle opportunità e dalle energie presenti nei luoghi che viviamo ogni giorno."
  },
  {
    number: "03",
    title: "Responsabilità",
    description: "Ascoltare significa approfondire, verificare e restituire aggiornamenti con trasparenza e continuità."
  }
];

const themes = [
  { label: "Salute", imagePosition: "object-left" },
  { label: "Ambiente", imagePosition: "object-center" },
  { label: "Cultura", imagePosition: "object-right" },
  { label: "Sviluppo locale", imagePosition: "object-left" },
  { label: "Giustizia sociale", imagePosition: "object-center" },
  { label: "Partecipazione", imagePosition: "object-right" }
];

const workingMethod = [
  {
    number: "01",
    title: "Ascoltiamo",
    description: "Raccogliamo segnalazioni, bisogni e idee dal territorio."
  },
  {
    number: "02",
    title: "Approfondiamo",
    description: "Analizziamo i temi con dati, confronto e competenze."
  },
  {
    number: "03",
    title: "Agiamo",
    description: "Trasformiamo le proposte in iniziative concrete."
  },
  {
    number: "04",
    title: "Aggiorniamo",
    description: "Rendiamo conto dei risultati e continuiamo ad ascoltare."
  }
];

export default function ManifestoPage() {
  return (
    <main className="bg-background pb-20 pt-16 text-foreground sm:pb-24 sm:pt-20">
      <div className="mx-auto grid w-full max-w-6xl gap-20 px-6 sm:gap-24 sm:px-8 lg:gap-28 lg:px-12">
        <header className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="grid content-center gap-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Manifesto</p>
            <div className="grid gap-5">
              <h1 className="font-serif text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
                Crediamo in un territorio che ascolta, partecipa e costruisce insieme.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Visione Comune nasce per ridurre la distanza tra persone, territorio e istituzioni, raccogliere i bisogni della comunità, far emergere idee e trasformare il confronto in iniziative concrete.
              </p>
            </div>
            <p className="border-t border-border pt-5 text-sm font-medium text-foreground">
              Persone · Territori · Idee · Azioni concrete
            </p>
          </div>

          <figure className="relative aspect-square overflow-hidden rounded-xl bg-muted">
            <Image
              alt="Veduta di Venafro"
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              src="/images/Venafro_Liberty_Movies.webp"
            />
          </figure>
        </header>

        <section aria-labelledby="principles-title" className="grid gap-10">
          <h2 className="font-serif text-3xl font-semibold tracking-normal sm:text-4xl" id="principles-title">I nostri principi</h2>
          <div className="grid border-y border-border md:grid-cols-3">
            {principles.map((principle) => (
              <article className="grid content-start gap-5 border-b border-border py-8 last:border-b-0 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0" key={principle.number}>
                <p className="text-xs font-semibold tracking-widest text-muted-foreground" aria-hidden="true">{principle.number}</p>
                <div className="grid gap-3">
                  <h3 className="font-serif text-3xl font-semibold tracking-normal">{principle.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{principle.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="themes-title" className="grid gap-10">
          <h2 className="font-serif text-3xl font-semibold tracking-normal sm:text-4xl" id="themes-title">I temi</h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {themes.map((theme) => (
              <li className="relative aspect-video overflow-hidden rounded-lg bg-muted" key={theme.label}>
                <Image
                  alt=""
                  aria-hidden="true"
                  className={`object-cover ${theme.imagePosition}`}
                  fill
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  src="/images/Venafro_Liberty_Movies.webp"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-foreground/40" />
                <p className="absolute inset-x-0 bottom-0 p-4 font-serif text-lg font-semibold tracking-normal text-primary-foreground sm:p-5 sm:text-2xl">
                  {theme.label}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="method-title" className="grid gap-10">
          <h2 className="font-serif text-3xl font-semibold tracking-normal sm:text-4xl" id="method-title">Come lavoriamo</h2>
          <ol className="grid border-y border-border sm:grid-cols-2 lg:grid-cols-4">
            {workingMethod.map((step) => (
              <li className="grid content-start gap-4 border-b border-border py-7 last:border-b-0 sm:px-6 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-child(odd)]:pl-0 lg:border-b-0 lg:border-r lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0" key={step.number}>
                <p className="text-xs font-semibold tracking-widest text-primary" aria-hidden="true">{step.number}</p>
                <div className="grid gap-2">
                  <h3 className="font-serif text-2xl font-semibold tracking-normal">{step.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="participate-title" className="grid gap-8 border-y border-border py-12 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:py-16">
          <div className="grid max-w-2xl gap-4">
            <h2 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl" id="participate-title">Partecipa</h2>
            <p className="text-base leading-7 text-muted-foreground">
              Visione Comune cresce con il contributo di chi vive il territorio. Segnala un problema o condividi un’idea.
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
