import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

export default function ManifestoPlaceholderPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <p className="text-sm font-semibold text-primary">Visione Comune</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Manifesto</h1>
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
        <Link className="text-sm font-semibold text-primary hover:underline" href="/">
          Torna alla Home
        </Link>
      </div>
    </main>
  );
}
