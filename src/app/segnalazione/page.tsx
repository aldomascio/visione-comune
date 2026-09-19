import { redirect } from "next/navigation";
import { TrackReportByPublicCodeUseCase, type TrackReportResult } from "@/modules/reports/application/public-report";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { createDatabaseConnection } from "@/shared/db/client";
import { Button, Input } from "@/shared/ui";

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
    <main className="flex flex-1 items-center bg-background px-6 py-14 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-xl gap-8">
        <section className="grid gap-3">
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Controlla una segnalazione</h1>
          <p className="text-base leading-7 text-muted-foreground">Inserisci il codice ricevuto dopo l&apos;invio.</p>
        </section>

        <form action="/segnalazione" className="grid gap-4" method="get">
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none text-muted-foreground" htmlFor="codice">Codice segnalazione</label>
            <Input
              autoCapitalize="characters"
              className="uppercase tracking-wide"
              defaultValue={code}
              id="codice"
              name="codice"
              pattern="VC-[0-9A-Z]{8}"
              placeholder="VC-XXXXXXXX"
              required
            />
          </div>
          <Button className="w-full sm:w-fit" type="submit">Controlla la segnalazione</Button>
        </form>

        {result ? <TrackingResult result={result} /> : null}
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
      <MessageBlock tone="error" title="Codice non valido">
        Controlla il codice e riprova.
      </MessageBlock>
    );
  }

  if (result.status === "not_found") {
    return (
      <MessageBlock tone="error" title="Segnalazione non trovata">
        Non abbiamo trovato una segnalazione associata a questo codice.
      </MessageBlock>
    );
  }

  if (result.status === "pending") {
    return (
      <MessageBlock title="Segnalazione ricevuta">
        La segnalazione è in verifica e non è ancora pubblica.
      </MessageBlock>
    );
  }

  return (
    <MessageBlock title="La segnalazione non è stata pubblicata">
      Il codice è valido, ma la scheda pubblica non è disponibile.
    </MessageBlock>
  );
}

function MessageBlock({
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
      className={tone === "error" ? "border-t border-destructive/40 pt-4" : "border-t border-border pt-4"}
      role={tone === "error" ? "alert" : "status"}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
