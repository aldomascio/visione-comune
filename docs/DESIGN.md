# Design Principles

## UX

1. Mobile first.
2. Segnalare deve richiedere pochi passaggi.
3. Evitare linguaggio burocratico.
4. Stato sempre comprensibile.
5. CTA primaria evidente.
6. Nessun account richiesto.
7. Errori spiegati in modo chiaro.
8. Conferme e duplicati devono essere comprensibili anche a utenti non tecnici.
9. La mappa non deve diventare caotica.
10. Il backoffice deve privilegiare velocita operativa.

## UI

La base visiva ufficiale dell'applicazione e il tema Tailwind CSS v4 fornito in VC-003B e integrato in `src/app/globals.css`.

Il tema usa token semantici CSS e Tailwind, cosi i componenti devono riferirsi a ruoli come `background`, `foreground`, `primary`, `muted`, `border`, `ring` e non a valori cromatici hardcoded quando esiste un token equivalente.

## Tailwind CSS v4

Tailwind e configurato tramite:

- `@import "tailwindcss"` in `src/app/globals.css`;
- `@theme inline` per esporre i token CSS come utility Tailwind;
- `@custom-variant dark (&:is(.dark *))` per la variante dark basata su classe `.dark`;
- plugin PostCSS `@tailwindcss/postcss` in `postcss.config.mjs`.

Non e presente una configurazione legacy Tailwind v3.

## Token colore

Token light principali:

- `--background`: sfondo applicazione;
- `--foreground`: testo principale;
- `--card` / `--card-foreground`: superfici card;
- `--popover` / `--popover-foreground`: superfici popover future;
- `--primary`: `#1a6b3a`;
- `--primary-foreground`: testo su primario;
- `--secondary` / `--secondary-foreground`: superfici secondarie;
- `--muted` / `--muted-foreground`: contenuti meno evidenti;
- `--accent` / `--accent-foreground`: accenti secondari;
- `--destructive` / `--destructive-foreground`: azioni distruttive o errori;
- `--border`, `--input`, `--ring`: bordi, campi e focus;
- `--chart-1` ... `--chart-5`: token per visualizzazioni future;
- `--sidebar` e relativi token: base per eventuale navigazione laterale futura.

La variante `.dark` e stata mantenuta con i token forniti. Non e ancora stato implementato un selettore tema nell'interfaccia.

## Typography

Il tema definisce:

- `--font-sans`: `Public Sans, ui-sans-serif, sans-serif, system-ui`;
- `--font-serif`: `Newsreader, ui-serif, serif`;
- `--font-mono`: `Source Code Pro, monospace`;
- `--tracking-normal`: `0em`.

Il `body` usa `--font-sans`. La preview tecnica usa `font-serif` solo per verificare il token serif. La strategia definitiva di caricamento dei font web non e ancora stata deliberata: al momento i nomi font sono dichiarati nel tema e usano fallback di sistema se i font non sono disponibili nel browser.

## Radius e shadow

Il tema definisce:

- `--radius`: `0.5rem`;
- utility derivate `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`;
- shadow da `--shadow-2xs` a `--shadow-2xl`.

Le primitive base usano radius e shadow tramite classi Tailwind collegate ai token del tema.

## Stili globali

Sono stati predisposti:

- background e foreground globali sul `body`;
- font globale basato su `--font-sans`;
- border color e outline coerenti con `border` e `ring`;
- focus state accessibile per elementi interattivi;
- selection color derivato da `primary`;
- comportamento base per controlli disabilitati.

## Primitive UI disponibili

Le primitive introdotte sono minime e riutilizzabili:

- `Button` con varianti `primary`, `secondary`, `outline`, `ghost`, `destructive`;
- `Input`;
- `Textarea`;
- `Select`;
- `Badge` con varianti `primary`, `secondary`, `outline`, `muted`;
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`;
- `Field` per label, controllo e hint.

Le primitive sono definite in `src/shared/ui/` e non dipendono da librerie UI esterne. Devono restare generiche e non incorporare regole di business.

## Pagina tecnica temporanea

La pagina attuale in `src/app/page.tsx` e una preview tecnica temporanea per verificare:

- colori;
- typography;
- badge;
- button;
- input;
- textarea;
- select;
- card;
- spacing;
- focus e disabled state.

Non rappresenta la home definitiva e non implementa il flusso reale di segnalazione.

## Componenti principali futuri

- header;
- hero;
- CTA "Segnala un problema";
- form multi-step o guidato;
- map view;
- report card;
- report detail;
- status badge;
- timeline;
- confirmation CTA;
- admin table/list;
- admin report detail;
- alerts;
- empty states.

Questi componenti non sono stati ancora implementati.
