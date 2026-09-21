import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

export default function NewsletterPlaceholderPage() {
  return (
    <main className="min-h-screen bg-background px-6 pb-10 pt-16 text-foreground sm:px-8 sm:pt-20 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">Newsletter</h1>
          <p className="text-base leading-7 text-muted-foreground">La sezione newsletter sarà disponibile prossimamente.</p>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Iscrizione non ancora attiva</CardTitle>
            <CardDescription>Nessun form iscrizione e nessun provider email sono stati configurati.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            La pagina e un placeholder di navigazione. La gestione newsletter resta fuori scope per questa task.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
