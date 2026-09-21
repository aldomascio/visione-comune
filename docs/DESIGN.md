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

Il tema usa token semantici CSS e Tailwind, cosi i componenti devono riferirsi a ruoli come `background`, `foreground`, `primary`, `success`, `warning`, `info`, `destructive`, `muted`, `border` e `ring`, senza valori cromatici hardcoded quando esiste un token equivalente.

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
- `--success`: `#1a6b3a`, per conferme, approvazioni, consegne e risoluzioni;
- `--warning`: `#a16207`, per stati da verificare, bozze operative e lavorazioni in corso;
- `--info`: `#25637a`, per stati informativi come segnalazioni pubblicate o comunicate;
- `--destructive`: `#b42318`, per azioni distruttive, errori, rifiuti e fallimenti;
- i relativi token `*-foreground` definiscono il testo sulle superfici semantiche;
- `--border`, `--input`, `--ring`: bordi, campi e focus;
- `--chart-1` ... `--chart-5`: token per visualizzazioni future;
- `--sidebar` e relativi token: base per eventuale navigazione laterale futura.

La variante `.dark` e stata mantenuta con i token forniti. Non e ancora stato implementato un selettore tema nell'interfaccia.

## Typography

Il tema definisce:

- `--font-sans`: `Public Sans, ui-sans-serif, sans-serif, system-ui`;
- `--font-serif`: Lora, caricata e ottimizzata tramite `next/font`, con fallback `ui-serif`;
- `--font-mono`: `Source Code Pro, monospace`;
- `--tracking-normal`: `0em`.

Il `body` usa `--font-sans`. Titoli e contenuti editoriali che usano `font-serif` ricevono Lora dal token globale; il font viene distribuito localmente dall'applicazione tramite `next/font`.

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
- `Badge` con varianti generiche `primary`, `secondary`, `outline`, `muted` e semantiche `success`, `warning`, `danger`, `info`;
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


## Mappa pubblica

La mappa pubblica usa i token del tema per layout, popup, badge, focus state e lista accessibile. I marker usano tutti `--primary` per mantenere la mappa pulita; lo stato resta esplicito nel testo e usa i token semantici nei badge (`info` per `Segnalata` e `Comunicata`, `success` per `Risolta`).

La mappa non e l'unico accesso alle informazioni: sotto la mappa e presente una lista accessibile con titolo, categoria, stato, indirizzo e link alla scheda pubblica. I filtri minimi per stato e categoria lavorano sui soli report pubblici gia caricati.


## Upload foto

La foto della segnalazione resta un contenuto secondario rispetto a descrizione, posizione e stato. Nel form viene mostrata una preview con azione `Rimuovi foto`; nel backoffice e nella scheda pubblica la foto usa card e bordi coerenti con il tema.

Alt text e messaggi di errore devono essere comprensibili: la UI indica formati supportati e limite di 10 MB, mentre la validazione definitiva resta server-side.

## App shell e navigazione

VC-016B introduce una shell di navigazione coerente senza definire ancora la home editoriale definitiva.

### Navigazione pubblica

La shell pubblica include:

- logo SVG in `public/logo.svg`, colorato con il token `foreground` e usato come link alla Home;
- menu principale con `Mappa`, `Manifesto`, `Notizie`, `Newsletter`;
- CTA primaria separata `Segnala un problema`;
- footer con link principali, tracking segnalazione, contatti placeholder e privacy placeholder.

Lo stato attivo usa `aria-current="page"` e classi basate sui token `primary`, `accent`, `muted`, `border`, `background` e `foreground`.

### Mobile

Il menu mobile e implementato senza dipendenze esterne. Il pulsante espone `aria-label`, `aria-expanded` e `aria-controls`; le voci hanno target ampi e il menu si chiude dopo la navigazione.

### Navigazione admin

La shell admin e distinta dalla navigazione pubblica e compare solo per sessioni admin attive. Include:

- indicazione `Area amministrativa`;
- email dell'admin autenticato;
- logout;
- link Dashboard, Segnalazioni, Categorie, Notizie, Destinatari, Smistamento.

Le route admin restano protette server-side: la shell e un aiuto di navigazione, non un controllo di sicurezza.

### Logo

Il logo SVG e disponibile in `public/logo.svg`. La shell lo mostra come mark grafico senza testo affiancato, usando una maschera CSS colorata con il token `foreground`, cosi resta coerente con il tema.



### Icone

Il set icone ufficiale dell'applicazione e `lucide-react`. Le icone devono essere usate come supporto alla comprensione di azioni, stati e navigazione, non come decorazione ridondante.

Linee guida iniziali:

- usare icone Lucide con dimensioni coerenti con il testo o il controllo che accompagnano;
- colorare le icone tramite `currentColor` e token esistenti, evitando colori hardcoded;
- mantenere label testuali visibili per azioni importanti;
- nascondere icone puramente decorative agli screen reader con `aria-hidden`;
- non introdurre altri set icone senza una decisione esplicita.

### Menu pubblico principale

Il menu pubblico principale contiene solo i link editoriali e di consultazione: `Mappa`, `Manifesto`, `Notizie`, `Newsletter`. Il logo resta il collegamento alla Home. La creazione segnalazione rimane una CTA separata, non una voce del menu principale.


### Notizie editoriali

La sezione Notizie usa card e pagine dettaglio coerenti con il tema. Dal VC-017B il contenuto e rich text controllato tramite Tiptap nell'area admin. Il rendering pubblico supporta solo paragrafi, H2, H3, grassetto, corsivo, link, elenchi puntati/numerati e blockquote.

Lo stile editoriale resta leggibile e aderente ai token: larghezza massima del testo, heading serif per H2, spaziatura verticale ampia, link `primary` sottolineati e citazioni con bordo derivato da `primary`. Non viene usato Tailwind Typography e non viene renderizzato HTML raw.

Le immagini in evidenza sono opzionali, usano percorsi locali sotto `public/`, hanno rapporto 16:9 e richiedono testo alternativo.

## Selezione posizione nel form segnalazione

VC-021B sostituisce i campi tecnici latitudine/longitudine con una UX orientata al cittadino.

Il form `/segnala` mostra:

- campo `Inserisci indirizzo` con ricerca assistita;
- pulsante `Usa la mia posizione` che chiede il permesso solo dopo click esplicito;
- mini mappa MapLibre centrata su Venafro per selezionare o correggere il punto.

Latitudine e longitudine restano dati interni inviati come campi nascosti solo dopo una selezione confermata. Se l'indirizzo viene modificato manualmente dopo una selezione, la posizione torna non confermata e l'utente deve scegliere nuovamente un suggerimento, usare la geolocalizzazione o cliccare sulla mappa.

La ricerca indirizzo usa debounce, soglia minima di 3 caratteri e massimo 5 risultati. Gli stati di errore spiegano che, se la ricerca non funziona, il punto puo essere selezionato direttamente sulla mappa.

## Home pubblica e public experience

VC-021C sostituisce la home tecnica con una Home pubblica definitiva per l'MVP. La pagina usa la stessa larghezza massima della shell pubblica (`max-w-6xl`) e mantiene il linguaggio visivo gia definito dal tema: card con bordo, serif per heading principali, CTA primarie `primary` e CTA secondarie `outline`.

La Home e organizzata in sezioni leggere e server-rendered:

- hero con messaggio progettuale sulla segnalazione, il tracking e la traccia pubblica;
- accessi rapidi a segnalazione, mappa, tracking, notizie e newsletter;
- spiegazione in sei passaggi del percorso di una segnalazione;
- metriche pubbliche aggregate;
- invito alla mappa senza caricare MapLibre nella Home;
- ultime notizie pubblicate;
- blocco tracking;
- blocco newsletter come rimando alla pagina esistente;
- ultimi problemi risolti quando disponibili.

La Home non introduce immagini stock, animazioni complesse, caroselli o contenuti politici. Gli stati vuoti restano visibili con card informative e non mostrano valori non validi.

### Refinement UI mappa pubblica

MAP-REFINEMENT aggiorna la mappa pubblica senza cambiare query, criteri di pubblicazione o business rule.

La mappa non usa lo stato come criterio visivo principale dei marker e non mostra una legenda per stato. Lo stato resta leggibile nel popup, nella lista accessibile e nei filtri.

Le segnalazioni `Risolta` restano accessibili, ma non vengono mostrate di default: il filtro iniziale mostra `Segnalate e comunicate`; l'utente puo scegliere `Risolta` o `Tutti gli stati` per includerle.

Mapping token categoria-marker:

- prima categoria: marker pieno con `primary`, dot `primary-foreground`, bordo `background`;
- seconda categoria: marker pieno con `foreground`, dot `background`, bordo `background`;
- terza categoria: marker pieno con `accent`, dot `accent-foreground`, bordo `background`;
- quarta categoria: marker pieno con `muted`, dot `foreground`, bordo `foreground`.

Se le categorie sono piu di quattro, gli stessi stili ruotano. Questo mantiene una distinzione visiva leggera per categoria usando solo token gia definiti dal tema, senza introdurre colori hardcoded.

I marker sono elementi focusabili e cliccabili con `aria-label`; hover, focus e selezione usano `ring` e ombra del tema. I popup usano `background`, `foreground`, `border`, `muted-foreground` e `primary`; categoria e stato sono sempre mostrati insieme.

Il clustering non e stato introdotto in questa iterazione: il dataset attuale e ancora leggibile con marker semplici, filtri e lista accessibile. Resta un miglioramento futuro se la densita delle segnalazioni cresce.
