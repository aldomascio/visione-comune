import Link from "next/link";
import { readBaseEnv } from "@/shared/config/env";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

export default function Home() {
  const env = readBaseEnv();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="grid gap-5">
            <Badge className="w-fit">Piattaforma civica</Badge>
            <div className="grid gap-3">
              <h1 className="max-w-6xl font-serif text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
                {env.appName}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Una home temporanea per accedere rapidamente a segnalazioni, mappa pubblica e tracking tramite codice. La home editoriale definitiva arriverà in una task dedicata.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/segnala">
                Segnala un problema
              </Link>
              <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/mappa">
                Vai alla mappa
              </Link>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cosa puoi fare ora</CardTitle>
              <CardDescription>Collegamenti principali disponibili nell&apos;MVP.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <HomeLink href="/segnala" label="Inviare una segnalazione senza account" />
              <HomeLink href="/mappa" label="Consultare la mappa pubblica" />
              <HomeLink href="/segnalazione" label="Controllare una segnalazione con codice" />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function HomeLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="rounded-lg border border-border bg-background p-4 font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href}>
      {label}
    </Link>
  );
}
