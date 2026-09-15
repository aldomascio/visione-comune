import { AlertCircle, ArrowLeft, CheckCircle2, Edit3, HelpCircle, MapPin, Send, Upload } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/shared/ui";
import { ModerationStatusBadge, PublicStatusBadge } from "../segnalazioni/status-badge";

export const dynamic = "force-dynamic";

const colorTokens = [
  { name: "Background", className: "bg-background", textClassName: "text-foreground" },
  { name: "Foreground", className: "bg-foreground", textClassName: "text-background" },
  { name: "Primary", className: "bg-primary", textClassName: "text-primary-foreground" },
  { name: "Secondary", className: "bg-secondary", textClassName: "text-secondary-foreground" },
  { name: "Muted", className: "bg-muted", textClassName: "text-muted-foreground" },
  { name: "Accent", className: "bg-accent", textClassName: "text-accent-foreground" },
  { name: "Destructive", className: "bg-destructive", textClassName: "text-destructive-foreground" },
  { name: "Card", className: "bg-card", textClassName: "text-card-foreground" }
];

const lucideIcons = [
  { label: "Indietro", Icon: ArrowLeft },
  { label: "Guida", Icon: HelpCircle },
  { label: "Posizione", Icon: MapPin },
  { label: "Invio", Icon: Send },
  { label: "Upload", Icon: Upload },
  { label: "Modifica", Icon: Edit3 },
  { label: "Successo", Icon: CheckCircle2 },
  { label: "Avviso", Icon: AlertCircle }
];

export default function AdminDesignSystemPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-3">
          <p className="text-sm font-semibold text-primary">Design system</p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal">Componenti UI</h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Riferimento interno per token visivi, componenti base, stati e icone dell&apos;applicazione.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Token e tipografia">
          <Card>
            <CardHeader>
              <CardTitle>Colori</CardTitle>
              <CardDescription>Token semantici principali usati dai componenti.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {colorTokens.map((token) => (
                  <div className="overflow-hidden rounded-lg border border-border" key={token.name}>
                    <div className={`${token.className} ${token.textClassName} flex min-h-20 items-end p-4`}>
                      <span className="text-sm font-semibold">{token.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipografia</CardTitle>
              <CardDescription>Gerarchia base usata nelle pagine pubbliche e admin.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-primary">Eyebrow</p>
                <h2 className="font-serif text-4xl font-semibold tracking-normal">Titolo serif principale</h2>
                <p className="text-base leading-7 text-muted-foreground">
                  Testo descrittivo con ritmo leggibile e colore attenuato per contenuti di supporto.
                </p>
              </div>
              <div className="grid gap-2 text-sm leading-6">
                <p><strong>Testo forte</strong> per dati chiave e label operative.</p>
                <p className="text-muted-foreground">Testo muted per hint, spiegazioni e metadati.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Componenti base">
          <Card>
            <CardHeader>
              <CardTitle>Bottoni</CardTitle>
              <CardDescription>Varianti disponibili nel design system.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button>Primario</Button>
              <Button variant="secondary">Secondario</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Distruttivo</Button>
              <Button disabled>Disabilitato</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Badge e stati</CardTitle>
              <CardDescription>Badge generici e stati di segnalazione.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge>Primary</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="muted">Muted</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <ModerationStatusBadge status="pending_review" />
                <ModerationStatusBadge status="approved" />
                <ModerationStatusBadge status="rejected" />
              </div>
              <div className="flex flex-wrap gap-2">
                <PublicStatusBadge status="reported" />
                <PublicStatusBadge status="communicated" />
                <PublicStatusBadge status="resolved" />
                <PublicStatusBadge />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]" aria-label="Form e feedback">
          <Card>
            <CardHeader>
              <CardTitle>Form</CardTitle>
              <CardDescription>Input, select, textarea e stati di errore.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field htmlFor="ds-name" label="Campo testo" hint="Hint breve sotto al campo.">
                <Input id="ds-name" placeholder="Valore di esempio" />
              </Field>
              <Field htmlFor="ds-select" label="Select">
                <Select id="ds-select" defaultValue="reported">
                  <option value="reported">Segnalata</option>
                  <option value="communicated">Comunicata</option>
                  <option value="resolved">Risolta</option>
                </Select>
              </Field>
              <Field htmlFor="ds-textarea" label="Textarea">
                <Textarea id="ds-textarea" placeholder="Descrizione del problema..." rows={4} />
              </Field>
              <Field htmlFor="ds-error" label="Campo con errore">
                <Input aria-invalid id="ds-error" defaultValue="Valore non valido" />
                <p className="text-sm font-medium text-destructive">Messaggio di errore chiaro.</p>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feedback</CardTitle>
              <CardDescription>Messaggi operativi e stati vuoti.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                <p className="font-semibold text-foreground">Operazione completata</p>
                <p className="mt-1 text-muted-foreground">Messaggio di conferma breve e specifico.</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
                <p className="font-semibold text-foreground">Controlla i campi evidenziati</p>
                <p className="mt-1 text-muted-foreground">Spiega come correggere il problema.</p>
              </div>
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm leading-6 text-muted-foreground">
                Stato vuoto per liste senza contenuti o risultati filtrati.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Icone e pattern">
          <Card>
            <CardHeader>
              <CardTitle>Icone Lucide</CardTitle>
              <CardDescription>Set icone ufficiale, colorato con currentColor.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {lucideIcons.map(({ Icon, label }) => (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3" key={label}>
                    <Icon aria-hidden="true" className="size-5 text-primary" strokeWidth={2} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Azioni con icona</CardTitle>
              <CardDescription>Le azioni importanti mantengono sempre una label testuale.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Button className="gap-2"><Send aria-hidden="true" className="size-4" />Invia</Button>
              <Button className="gap-2" variant="secondary"><Edit3 aria-hidden="true" className="size-4" />Modifica</Button>
              <Button className="gap-2" variant="outline"><Upload aria-hidden="true" className="size-4" />Carica foto</Button>
              <Button aria-label="Guida" className="size-10 rounded-full px-0" variant="outline">?</Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
