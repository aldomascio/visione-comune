import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

export default function PrivacyPlaceholderPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <p className="text-sm font-semibold text-primary">Visione Comune</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Privacy e policy</h1>
          <p className="text-base leading-7 text-muted-foreground">Informativa definitiva in preparazione.</p>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Placeholder privacy</CardTitle>
            <CardDescription>La policy completa deve essere definita prima della pubblicazione finale.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Questa pagina non sostituisce l&apos;informativa privacy definitiva. Serve solo a evitare link non risolti nella navigazione pubblica.
          </CardContent>
        </Card>
        <Link className="text-sm font-semibold text-primary hover:underline" href="/">
          Torna alla Home
        </Link>
      </div>
    </main>
  );
}
