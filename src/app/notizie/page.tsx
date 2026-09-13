import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

export default function NewsPlaceholderPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <p className="text-sm font-semibold text-primary">Visione Comune</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Notizie</h1>
          <p className="text-base leading-7 text-muted-foreground">Sezione in preparazione.</p>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Notizie in arrivo</CardTitle>
            <CardDescription>Nessun CMS o contenuto editoriale e stato ancora implementato.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Questa pagina serve solo a completare la navigazione dell&apos;app shell in attesa della vertical slice dedicata.
          </CardContent>
        </Card>
        <Link className="text-sm font-semibold text-primary hover:underline" href="/">
          Torna alla Home
        </Link>
      </div>
    </main>
  );
}
