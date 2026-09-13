import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { GetPublicPlatformMetricsUseCase } from "@/modules/analytics/application/operational-metrics";
import { buildHomePublicMetricCards, type HomePublicMetricCard } from "@/modules/analytics/application/public-platform-home-metrics";
import { ListPublishedNewsPostsUseCase } from "@/modules/news/application/manage-news-posts";
import type { NewsPostListItem } from "@/modules/news/application/news-post-repository";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { ListRecentResolvedPublicReportsUseCase } from "@/modules/reports/application/public-report";
import type { RecentResolvedPublicReport } from "@/modules/reports/application/report-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { DrizzleOperationalMetricsRepository } from "@/modules/analytics/infrastructure/drizzle-operational-metrics-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Badge } from "@/shared/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Visione Comune | Segnalazioni, mappa e aggiornamenti",
  description:
    "La piattaforma digitale di Visione Comune per segnalare problemi, seguirne il percorso, consultare la mappa e restare aggiornati.",
  openGraph: {
    title: "Visione Comune | Segnalazioni, mappa e aggiornamenti",
    description:
      "Segnala un problema, segui il suo percorso e consulta gli aggiornamenti pubblici del territorio.",
    type: "website"
  }
};

type HomePageData = {
  metrics: HomePublicMetricCard[];
  latestNews: NewsPostListItem[];
  recentResolvedReports: RecentResolvedPublicReport[];
};

const quickActions = [
  {
    title: "Segnala un problema",
    description: "Invia una segnalazione senza account e conserva il codice pubblico.",
    href: "/segnala",
    cta: "Vai al form"
  },
  {
    title: "Mappa",
    description: "Guarda le segnalazioni approvate sul territorio.",
    href: "/mappa",
    cta: "Apri la mappa"
  },
  {
    title: "Controlla segnalazione",
    description: "Usa il codice ricevuto per vedere lo stato del percorso.",
    href: "/segnalazione",
    cta: "Controlla lo stato"
  },
  {
    title: "Notizie",
    description: "Leggi aggiornamenti e comunicazioni pubblicate.",
    href: "/notizie",
    cta: "Leggi le notizie"
  },
  {
    title: "Newsletter",
    description: "Rimani aggiornato quando l'iscrizione sarà attiva.",
    href: "/newsletter",
    cta: "Vai alla newsletter"
  }
];

const workflowSteps = [
  "Segnala un problema indicando categoria, posizione e descrizione.",
  "Visione Comune verifica il contenuto prima della pubblicazione.",
  "La segnalazione approvata diventa visibile nella scheda pubblica e sulla mappa.",
  "Il problema viene comunicato all'ente competente quando la consegna è confermata.",
  "Puoi seguirne lo stato con il codice ricevuto dopo l'invio.",
  "Quando il problema è risolto, resta traccia del percorso pubblico."
];

export default async function Home() {
  const { metrics, latestNews, recentResolvedReports } = await getHomePageData();

  return (
    <main className="bg-background text-foreground">
      <div className="px-6 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="mx-auto grid w-full max-w-6xl gap-16">
          <section className="relative overflow-hidden rounded-[2rem] bg-muted px-6 py-8 sm:px-8 lg:px-10 lg:py-12">
            <div className="absolute right-0 top-0 h-56 w-56 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
            <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-background/70 blur-3xl" aria-hidden="true" />
            <div className="relative grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div className="grid gap-6">
                <Badge className="w-fit">Piattaforma digitale civica</Badge>
                <div className="grid gap-4">
                  <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
                    Segnala un problema, segui il percorso, guarda cosa cambia nel tempo.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    Visione Comune raccoglie segnalazioni civiche, le verifica prima della pubblicazione e rende consultabile lo stato dei problemi segnalati sul territorio.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <PrimaryLink href="/segnala">Segnala un problema</PrimaryLink>
                  <SecondaryLink href="/mappa">Esplora la mappa</SecondaryLink>
                </div>
              </div>

              <div className="grid gap-4 rounded-2xl bg-background/80 p-5 shadow-sm ring-1 ring-border/80 backdrop-blur">
                <p className="text-sm font-semibold text-primary">In pratica</p>
                <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
                  <p><span className="font-semibold text-foreground">1.</span> Invii senza account.</p>
                  <p><span className="font-semibold text-foreground">2.</span> Visione Comune verifica.</p>
                  <p><span className="font-semibold text-foreground">3.</span> Segui lo stato con il codice.</p>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="azioni-rapide" className="grid gap-6">
            <SectionIntro
              eyebrow="Accesso rapido"
              title="Le funzioni principali"
              description="I percorsi più usati sono raggiungibili subito dalla Home."
              id="azioni-rapide"
            />
            <div className="flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Link
                  className="group inline-flex min-h-12 items-center gap-3 rounded-full bg-muted px-5 py-3 text-sm font-semibold transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href={action.href}
                  key={action.href}
                  title={action.description}
                >
                  {action.title}
                  <span className="text-primary transition-colors group-hover:text-primary-foreground" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="come-funziona" className="grid gap-6 lg:grid-cols-[0.45fr_1fr] lg:gap-12">
            <SectionIntro
              eyebrow="Come funziona"
              title="Dal primo invio alla traccia pubblica"
              description="Il percorso è pensato per essere semplice per il cittadino e verificabile nel tempo."
              id="come-funziona"
            />
            <ol className="relative grid gap-5 before:absolute before:left-4 before:top-4 before:h-[calc(100%-2rem)] before:w-px before:bg-border sm:grid-cols-2 sm:before:hidden lg:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <li className="relative grid gap-3 rounded-2xl bg-background p-1" key={step}>
                  <div className="grid min-h-36 content-start gap-4 rounded-[1.1rem] bg-muted/70 p-5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-muted-foreground">{step}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="metriche-pubbliche" className="rounded-[2rem] bg-foreground p-6 text-background sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.5fr_1fr] lg:items-start">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-background/70">Risultati pubblici</p>
                <h2 className="font-serif text-3xl font-semibold tracking-normal" id="metriche-pubbliche">
                  Cosa sta producendo il sistema
                </h2>
                <p className="text-sm leading-6 text-background/70">
                  Solo dati aggregati e pubblicabili, senza informazioni interne o personali.
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                {metrics.map((metric) => (
                  <div className="grid gap-2" data-testid={`home-metric-${metric.key}`} key={metric.key}>
                    <p className="text-sm leading-5 text-background/65">{metric.label}</p>
                    <p className="font-serif text-4xl font-semibold text-background">{metric.value}</p>
                    <p className="text-xs leading-5 text-background/60">{metric.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="mappa-territorio" className="grid gap-6 rounded-[2rem] border border-border p-6 sm:p-8 lg:grid-cols-[1fr_18rem] lg:items-center">
            <div className="grid gap-3">
              <p className="text-sm font-semibold text-primary">Mappa pubblica</p>
              <h2 id="mappa-territorio" className="font-serif text-3xl font-semibold tracking-normal">
                Esplora i problemi segnalati sul territorio
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                La mappa mostra le segnalazioni già verificate e approvate. Quelle ancora in verifica non vengono pubblicate.
              </p>
            </div>
            <div className="grid min-h-44 content-between rounded-2xl bg-muted p-5">
              <div className="grid grid-cols-3 gap-2" aria-hidden="true">
                <span className="h-12 rounded-xl bg-primary/20" />
                <span className="h-12 rounded-xl bg-primary/10" />
                <span className="h-12 rounded-xl bg-primary/25" />
                <span className="h-12 rounded-xl bg-primary/10" />
                <span className="h-12 rounded-xl bg-primary/30" />
                <span className="h-12 rounded-xl bg-primary/10" />
              </div>
              <SecondaryLink href="/mappa">Apri la mappa</SecondaryLink>
            </div>
          </section>

          <section aria-labelledby="ultime-notizie" className="grid gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionIntro
                eyebrow="Aggiornamenti"
                title="Ultime notizie"
                description="Le comunicazioni pubblicate più recenti."
                id="ultime-notizie"
              />
              <SecondaryLink href="/notizie">Vedi tutte le notizie</SecondaryLink>
            </div>
            {latestNews.length === 0 ? (
              <EmptyBlock title="Nessuna notizia pubblicata" description="Gli aggiornamenti pubblici compariranno qui appena disponibili." />
            ) : (
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                {latestNews.map((post, index) => (
                  <article
                    className={
                      index === 0
                        ? "grid gap-4 rounded-[2rem] bg-muted p-6 sm:p-8 lg:row-span-2"
                        : "grid content-start gap-3 rounded-2xl border border-border p-5"
                    }
                    key={post.id}
                  >
                    <p className="text-sm font-medium text-muted-foreground">{formatPublicDate(post.publishedAt)}</p>
                    <h3 className={index === 0 ? "font-serif text-3xl font-semibold" : "text-xl font-semibold"}>{post.title}</h3>
                    {post.excerpt ? <p className="text-sm leading-6 text-muted-foreground">{post.excerpt}</p> : null}
                    <Link className="text-sm font-semibold text-primary hover:underline" href={`/notizie/${post.slug}`}>
                      Leggi aggiornamento
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="grid content-start gap-4 rounded-[2rem] bg-primary p-6 text-primary-foreground sm:p-8">
              <p className="text-sm font-semibold text-primary-foreground/75">Tracking</p>
              <h2 className="font-serif text-3xl font-semibold" id="tracking-home">
                Hai già segnalato un problema?
              </h2>
              <p className="text-sm leading-6 text-primary-foreground/80">
                Usa il codice ricevuto dopo l&apos;invio per seguire lo stato della segnalazione, senza account.
              </p>
              <div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary-foreground px-5 py-3 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                  href="/segnalazione"
                >
                  Controlla lo stato
                </Link>
              </div>
            </div>

            <div className="grid content-start gap-4 rounded-[2rem] bg-muted p-6 sm:p-8">
              <p className="text-sm font-semibold text-primary">Newsletter</p>
              <h2 className="font-serif text-3xl font-semibold" id="newsletter-home">
                Resta aggiornato sugli sviluppi
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                La sezione newsletter raccoglierà il percorso di iscrizione quando il provider email sarà configurato.
              </p>
              <div>
                <SecondaryLink href="/newsletter">Iscriviti alla newsletter</SecondaryLink>
              </div>
            </div>
          </section>

          <section aria-labelledby="ultimi-risolti" className="grid gap-6">
            <SectionIntro
              eyebrow="Traccia pubblica"
              title="Ultimi problemi risolti"
              description="Una selezione delle segnalazioni concluse più di recente."
              id="ultimi-risolti"
            />
            {recentResolvedReports.length === 0 ? (
              <EmptyBlock title="Nessun problema risolto da mostrare" description="Quando una segnalazione verrà verificata come risolta, apparirà in questa sezione." />
            ) : (
              <div className="grid gap-3">
                {recentResolvedReports.map((report) => (
                  <Link
                    className="grid gap-2 rounded-2xl bg-muted px-5 py-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[11rem_1fr_auto] md:items-center"
                    href={`/segnalazioni/${report.publicCode}`}
                    key={report.publicCode}
                  >
                    <p className="text-sm font-medium text-muted-foreground">{formatPublicDate(report.resolvedAt)}</p>
                    <div>
                      <h3 className="text-base font-semibold">{report.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{report.categoryName}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">Apri scheda pubblica</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

async function getHomePageData(): Promise<HomePageData> {
  let connection;

  try {
    connection = createDatabaseConnection();
    const metricsRepository = new DrizzleOperationalMetricsRepository(connection.db);
    const newsPostRepository = new DrizzleNewsPostRepository(connection.db);
    const reportRepository = new DrizzleReportRepository(connection.db);

    const [metrics, latestNews, recentResolvedReports] = await Promise.all([
      new GetPublicPlatformMetricsUseCase({ metricsRepository }).execute(),
      new ListPublishedNewsPostsUseCase({ newsPostRepository }).execute({ limit: 3 }),
      new ListRecentResolvedPublicReportsUseCase({ reportRepository }).execute({ limit: 3 })
    ]);

    return {
      metrics: buildHomePublicMetricCards(metrics),
      latestNews,
      recentResolvedReports
    };
  } finally {
    await connection?.close();
  }
}

function SectionIntro({
  description,
  eyebrow,
  id,
  title
}: {
  description: string;
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="font-serif text-3xl font-semibold tracking-normal" id={id}>
        {title}
      </h2>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function EmptyBlock({ description, title }: { description: string; title: string }) {
  return (
    <div className="border-y border-dashed border-border py-6 text-sm leading-6 text-muted-foreground">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

function PrimaryLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      href={href}
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      href={href}
    >
      {children}
    </Link>
  );
}

function formatPublicDate(date: Date | null): string {
  if (!date) {
    return "Data non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(date);
}
