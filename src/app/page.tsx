import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CircleAlert, Lightbulb, Map, Search, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { GetPublicPlatformMetricsUseCase } from "@/modules/analytics/application/operational-metrics";
import { buildHomePublicMetricCards, type HomePublicMetricCard } from "@/modules/analytics/application/public-platform-home-metrics";
import { DrizzleOperationalMetricsRepository } from "@/modules/analytics/infrastructure/drizzle-operational-metrics-repository";
import { ListPublishedNewsPostsUseCase } from "@/modules/news/application/manage-news-posts";
import type { NewsPostListItem } from "@/modules/news/application/news-post-repository";
import { DrizzleNewsPostRepository } from "@/modules/news/infrastructure/drizzle-news-post-repository";
import { ListPublicReportsForMapUseCase, type PublicReportMapView } from "@/modules/reports/application/public-map";
import { ListRecentResolvedPublicReportsUseCase } from "@/modules/reports/application/public-report";
import type { RecentResolvedPublicReport } from "@/modules/reports/application/report-repository";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { readPublicMapConfig, type PublicMapConfig } from "@/shared/config/map";
import { cn } from "@/shared/ui";
import { PublicReportsMap } from "./mappa/public-reports-map";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Visione Comune | Uno spazio civico per il territorio",
  description: "Segnala problemi, proponi idee e segui ciò che succede nel territorio di Venafro."
};

type HomePageData = {
  metrics: HomePublicMetricCard[];
  latestNews: NewsPostListItem[];
  recentResolvedReports: RecentResolvedPublicReport[];
  publicReports: PublicReportMapView[];
  mapConfig: PublicMapConfig;
};

const quickActions: Array<{ title: string; description: string; linkLabel: string; href: string; icon: LucideIcon }> = [
  {
    title: "Segnala un problema",
    description: "Raccontaci cosa non va e dove si trova.",
    linkLabel: "Inizia la segnalazione",
    href: "/segnala",
    icon: CircleAlert
  },
  {
    title: "Esplora la mappa",
    description: "Guarda le segnalazioni pubblicate sul territorio.",
    linkLabel: "Vai alla mappa",
    href: "/mappa",
    icon: Map
  },
  {
    title: "Segui una segnalazione",
    description: "Controlla stato e aggiornamenti con il tuo codice.",
    linkLabel: "Controlla una segnalazione",
    href: "/segnalazione",
    icon: Search
  },
  {
    title: "Proponi un’idea",
    description: "Condividi una proposta direttamente con Visione Comune.",
    linkLabel: "Invia una proposta",
    href: "/proponi",
    icon: Lightbulb
  }
];

const homeMetricKeys = new Set(["published", "communicated", "resolved"]);

export default async function Home() {
  const { metrics, latestNews, recentResolvedReports, publicReports, mapConfig } = await getHomePageData();
  const visibleMetrics = metrics.filter((metric) => homeMetricKeys.has(metric.key));

  return (
    <main className="bg-background text-foreground">
      <section className="relative grid min-h-svh place-items-center overflow-hidden px-6 py-28 text-primary-foreground sm:px-8 lg:px-12">
        <Image
          alt="Veduta del territorio di Venafro"
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src="/images/Venafro_Liberty_Movies.webp"
        />
        <div aria-hidden="true" className="home-hero-overlay absolute inset-0" />
        <div aria-hidden="true" className="home-hero-noise absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-6xl justify-items-center gap-8 text-center">
          <div className="grid max-w-4xl gap-4">
            <h1 className="font-serif text-5xl font-semibold tracking-normal sm:text-6xl lg:text-7xl">Più vicini al territorio, più vicini alle persone.</h1>
            <p className="text-lg leading-8 text-primary-foreground/85 sm:text-xl">
              Visione Comune raccoglie segnalazioni, idee e aggiornamenti per rendere più semplice partecipare, informarsi e contribuire alla vita della città.
            </p>
          </div>
          <div className="flex w-full max-w-md flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
            <PrimaryLink href="/segnala">Segnala un problema</PrimaryLink>
            <HeroSecondaryLink href="#esplora-progetto">Esplora il progetto</HeroSecondaryLink>
          </div>
        </div>
      </section>

      <div className="px-6 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24" id="esplora-progetto">
        <div className="mx-auto grid w-full max-w-6xl gap-20 lg:gap-28">
          <section aria-labelledby="azioni-home" className="grid gap-8">
            <div className="grid gap-2">
              <h2 className="font-serif text-4xl font-semibold" id="azioni-home">Partecipa a Visione Comune</h2>
              <p className="text-base leading-7 text-muted-foreground">Gli strumenti per partecipare, informarti e contribuire alla vita del territorio.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map(({ description, href, icon: Icon, linkLabel, title }) => (
                <article className="flex h-full flex-col rounded-xl bg-card p-6" key={href}>
                  <span className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-5 font-serif text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                  <TextLink className="mt-auto pt-8" href={href}>{linkLabel}</TextLink>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="attivita-home" className="home-territory-section grid gap-8 py-16 sm:py-20">
            <div className="grid gap-2">
              <h2 className="font-serif text-4xl font-semibold" id="attivita-home">Cosa sta succedendo sul territorio</h2>
              <p className="text-base leading-7 text-muted-foreground">Uno sguardo ai problemi segnalati e a come stanno evolvendo.</p>
            </div>
            <dl className="grid divide-y divide-border overflow-hidden rounded-xl bg-background sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {visibleMetrics.map((metric) => (
                <div className="grid gap-2 p-6 sm:p-8" data-testid={`home-metric-${metric.key}`} key={metric.key}>
                  <dt className="order-2 font-serif text-xl font-medium">{metric.label}</dt>
                  <dd className="order-1 font-serif text-5xl font-semibold text-primary">{metric.value}</dd>
                  <p className="order-3 text-sm leading-6 text-muted-foreground">{metric.hint}</p>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="mappa-home" className="grid gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-2">
                <h2 className="font-serif text-4xl font-semibold" id="mappa-home">Mappa delle segnalazioni</h2>
                <p className="text-base leading-7 text-muted-foreground">Una vista sul territorio e sui problemi già pubblicati.</p>
              </div>
              <TextLink href="/mappa">Esplora la mappa</TextLink>
            </div>
            <PublicReportsMap compact config={mapConfig} reports={publicReports} />
          </section>

          <section aria-labelledby="aggiornamenti-home" className="grid gap-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-2">
                <h2 className="font-serif text-4xl font-semibold" id="aggiornamenti-home">Ultimi aggiornamenti</h2>
                <p className="text-base leading-7 text-muted-foreground">Notizie, iniziative e aggiornamenti da Visione Comune.</p>
              </div>
              <TextLink href="/notizie">Vedi tutte le notizie</TextLink>
            </div>
            {latestNews.length === 0 ? <EmptyBlock text="Non ci sono aggiornamenti pubblicati." /> : (
              <div className="divide-y divide-border">
                {latestNews.map((post) => (
                  <article className="grid gap-3 py-6 md:grid-cols-[10rem_1fr] md:gap-8" key={post.id}>
                    <p className="text-sm text-muted-foreground">{formatPublicDate(post.publishedAt)}</p>
                    <div className="grid gap-2">
                      <h3 className="font-serif text-2xl font-semibold"><Link className="hover:text-primary" href={`/notizie/${post.slug}`}>{post.title}</Link></h3>
                      {post.excerpt ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{post.excerpt}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {recentResolvedReports.length > 0 ? (
            <section aria-labelledby="risolti-home" className="grid gap-8">
              <h2 className="font-serif text-4xl font-semibold" id="risolti-home">Problemi risolti</h2>
              <div className="divide-y divide-border border-y border-border">
                {recentResolvedReports.map((report) => (
                  <Link className="grid gap-2 py-5 transition-colors hover:text-primary sm:grid-cols-[1fr_auto] sm:items-center" href={`/segnalazioni/${report.publicCode}`} key={report.publicCode}>
                    <div><p className="text-sm text-muted-foreground">{report.categoryName}</p><h3 className="mt-1 font-medium">{report.title}</h3></div>
                    <span className="text-sm text-muted-foreground">Risolto · {formatPublicDate(report.resolvedAt)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

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
    const [metrics, latestNews, recentResolvedReports, publicReports] = await Promise.all([
      new GetPublicPlatformMetricsUseCase({ metricsRepository }).execute(),
      new ListPublishedNewsPostsUseCase({ newsPostRepository }).execute({ limit: 3 }),
      new ListRecentResolvedPublicReportsUseCase({ reportRepository }).execute({ limit: 3 }),
      new ListPublicReportsForMapUseCase({ reportRepository }).execute()
    ]);
    return { metrics: buildHomePublicMetricCards(metrics), latestNews, recentResolvedReports, publicReports, mapConfig: readPublicMapConfig() };
  } finally {
    await connection?.close();
  }
}

function EmptyBlock({ text }: { text: string }) { return <p className="border-y border-border py-6 text-sm text-muted-foreground">{text}</p>; }
function PrimaryLink({ children, href }: { children: ReactNode; href: string }) { return <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href}>{children}</Link>; }
function HeroSecondaryLink({ children, href }: { children: ReactNode; href: string }) { return <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary-foreground/60 bg-transparent px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground" href={href}>{children}</Link>; }
function TextLink({ children, className, href }: { children: ReactNode; className?: string; href: string }) { return <Link className={cn("inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline", className)} href={href}>{children}<ArrowRight aria-hidden="true" className="size-4" /></Link>; }
function formatPublicDate(date: Date | null): string { return date ? new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(date) : "Data non disponibile"; }
