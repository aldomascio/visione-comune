import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

export default function ManifestoPlaceholderPage() {
  return (
    <main className="min-h-screen bg-background px-6 pb-10 pt-16 text-foreground sm:px-8 sm:pt-20 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">Manifesto</h1>
          <p className="text-base leading-7 text-muted-foreground">Pagina manifesto in preparazione.</p>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Manifesto in arrivo</CardTitle>
            <CardDescription>I contenuti valoriali definitivi saranno inseriti in una task dedicata.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Questa pagina serve a completare la navigazione pubblica senza introdurre ancora contenuti editoriali definitivi.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
