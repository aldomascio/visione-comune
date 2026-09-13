import Link from "next/link";
import { redirect } from "next/navigation";
import { TrackReportByPublicCodeUseCase, type TrackReportResult } from "@/modules/reports/application/public-report";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/shared/ui";

type TrackingPageProps = {
  searchParams?: Promise<{ codice?: string }>;
};

export const dynamic = "force-dynamic";

export default async function TrackingPage({ searchParams }: TrackingPageProps) {
  const params = await searchParams;
  const code = params?.codice?.trim().toUpperCase() ?? "";
  const result = code ? await trackReport(code) : null;

  if (result?.status === "published") {
    redirect(`/segnalazioni/${result.publicCode}`);
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3 text-center">
          <p className="text-sm font-semibold text-primary">Visione Comune</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Controlla una segnalazione</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Inserisci il codice ricevuto dopo l&apos;invio. Non servono account, email o altri dati personali.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Codice segnalazione</CardTitle>
            <CardDescription>Il formato e simile a VC-XXXXXXXX.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <form action="/segnalazione" className="grid gap-4" method="get">
              <Field htmlFor="codice" label="Codice segnalazione">
                <Input
                  autoCapitalize="characters"
                  defaultValue={code}
                  id="codice"
                  name="codice"
                  pattern="VC-[0-9A-Z]{8}"
                  placeholder="VC-XXXXXXXX"
                  required
                />
              </Field>
              <Button type="submit">Controlla segnalazione</Button>
            </form>

            {result ? <TrackingResult result={result} /> : null}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <Link className="font-semibold text-primary hover:underline" href="/segnala">
            Invia una nuova segnalazione
          </Link>
        </div>
      </div>
    </main>
  );
}

async function trackReport(publicCode: string): Promise<TrackReportResult> {
  let connection;

  try {
    connection = createDatabaseConnection();
    return await new TrackReportByPublicCodeUseCase({
      reportRepository: new DrizzleReportRepository(connection.db)
    }).execute({ publicCode });
  } finally {
    await connection?.close();
  }
}

function TrackingResult({ result }: { result: Exclude<TrackReportResult, { status: "published" }> }) {
  if (result.status === "invalid_code") {
    return (
      <MessageCard tone="error" title="Codice non valido">
        Controlla il codice e riprova. Deve avere il formato VC-XXXXXXXX.
      </MessageCard>
    );
  }

  if (result.status === "not_found") {
    return (
      <MessageCard tone="error" title="Segnalazione non trovata">
        Non abbiamo trovato una segnalazione associata a questo codice.
      </MessageCard>
    );
  }

  if (result.status === "pending") {
    return (
      <MessageCard title="Segnalazione ricevuta">
        Stiamo verificando la tua segnalazione. Non e ancora pubblica e non compare nelle pagine pubbliche.
      </MessageCard>
    );
  }

  return (
    <MessageCard title="La segnalazione non e stata pubblicata">
      Il codice e valido, ma la segnalazione non e disponibile come scheda pubblica.
    </MessageCard>
  );
}

function MessageCard({
  children,
  title,
  tone = "info"
}: {
  children: React.ReactNode;
  title: string;
  tone?: "info" | "error";
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-lg border border-destructive/30 bg-destructive/10 p-4"
          : "rounded-lg border border-primary/30 bg-primary/10 p-4"
      }
      role={tone === "error" ? "alert" : "status"}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
