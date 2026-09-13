import { readBaseEnv } from "@/shared/config/env";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea
} from "@/shared/ui";

const tokenSamples = [
  { name: "Background", className: "bg-background text-foreground" },
  { name: "Card", className: "bg-card text-card-foreground" },
  { name: "Primary", className: "bg-primary text-primary-foreground" },
  { name: "Secondary", className: "bg-secondary text-secondary-foreground" },
  { name: "Muted", className: "bg-muted text-muted-foreground" },
  { name: "Accent", className: "bg-accent text-accent-foreground" }
];

export default function Home() {
  const env = readBaseEnv();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-5 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Bootstrap tecnico</Badge>
            <Badge variant="outline">Tailwind CSS v4</Badge>
          </div>
          <div className="grid gap-3">
            <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
              {env.appName}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Preview tecnica temporanea della design foundation. Questa pagina verifica token,
              typography, primitive UI e stati interattivi senza introdurre funzionalita applicative.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Token colore">
          {tokenSamples.map((sample) => (
            <div
              className={`${sample.className} rounded-lg border border-border p-5 shadow-xs`}
              key={sample.name}
            >
              <p className="text-sm font-semibold">{sample.name}</p>
              <p className="mt-2 text-sm opacity-80">Token semantico del tema fornito.</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Primitive UI</CardTitle>
              <CardDescription>
                Componenti base riutilizzabili costruiti sui token ufficiali del tema.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-3">
                <Button>Primario</Button>
                <Button variant="secondary">Secondario</Button>
                <Button variant="outline">Outline</Button>
                <Button disabled>Disabilitato</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Primary</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="muted">Muted</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campi form tecnici</CardTitle>
              <CardDescription>
                Esempi non funzionali per verificare focus, disabled, border e testo di supporto.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field
                hint="Campo dimostrativo: non salva e non invia dati."
                htmlFor="preview-title"
                label="Titolo segnalazione"
              >
                <Input id="preview-title" placeholder="Esempio di input" />
              </Field>
              <Field htmlFor="preview-category" label="Categoria">
                <Select id="preview-category" defaultValue="">
                  <option value="" disabled>
                    Seleziona una voce di preview
                  </option>
                  <option>Illuminazione</option>
                  <option>Strade</option>
                </Select>
              </Field>
              <Field htmlFor="preview-description" label="Descrizione">
                <Textarea id="preview-description" placeholder="Esempio di textarea" />
              </Field>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
