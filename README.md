# Visione Comune

Repository del progetto digitale di Visione Comune.

## Obiettivo

Costruire un ecosistema digitale unico per sito, piattaforma di segnalazione, mappa, backoffice, newsletter e comunicazione con gli enti.

## Documentazione

- `PROJECT_CONTEXT.md` → contesto generale del progetto
- `PRODUCT.md` → perimetro funzionale e MVP
- `BUSINESS_RULES.md` → regole di prodotto da non violare
- `USER_FLOWS.md` → flussi principali
- `EDGE_CASES.md` → casi limite noti
- `DATA_MODEL.md` → modello dati concettuale
- `ARCHITECTURE.md` → principi architetturali
- `TEST_PLAN.md` → scenari di test
- `DECISIONS.md` → decisioni prese
- `DESIGN.md` → principi UX/UI
- `AGENTS.md` → istruzioni per agenti di coding
- `STACK_EVALUATION.md` → criteri per scegliere lo stack

## Stato

Il progetto è in fase di predisposizione tecnica. Alcune decisioni implementative sono ancora da definire, in particolare PEC, provider newsletter, infrastruttura definitiva e servizi AI.

## Sviluppo locale

Requisiti:

- Node.js 24 LTS
- pnpm 12

Comandi principali:

```bash
pnpm install
pnpm dev
```

Verifiche:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Il server usato manualmente nel browser e `pnpm dev` su `http://localhost:3000`. I test end-to-end riusano questo server se e gia attivo; altrimenti avviano un server isolato su `http://127.0.0.1:3100`. Questo evita che Playwright provi ad accendere un secondo `next dev` mentre stai navigando l'app in locale.

Database locale:

Per l'MVP usiamo PostgreSQL locale in sviluppo, preferibilmente tramite Postgres.app su macOS. Servono due database separati:

- `visione_comune_dev`
- `visione_comune_test`

Le connection string reali devono stare solo in file locali ignorati da Git:

- `.env.local` con `DATABASE_URL`
- `.env.test.local` con `TEST_DATABASE_URL`

`.env.example` contiene solo placeholder.

Se usi Postgres.app e i binari non sono nel `PATH`, puoi creare i database con il percorso dell'app:

```bash
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb visione_comune_dev
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb visione_comune_test
```

Comandi database:

```bash
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed:dev
pnpm test:integration
```

`pnpm db:migrate:dev` usa `.env.local`. `pnpm db:seed:dev` inserisce categorie provvisorie di sviluppo e 8 notizie pubblicate di esempio con immagini locali in `public/news/` e contenuto rich text JSONB; questi contenuti non sono definitivi. Per provare `/segnala` in locale servono migration applicate e almeno una categoria attiva nel database.

`pnpm test:integration` usa `.env.test.local` ed esegue test reali contro PostgreSQL. Gli integration test dentro `pnpm test` restano saltati se `TEST_DATABASE_URL` non è configurata nell'ambiente corrente.

Autenticazione admin:

Per usare l'area `/admin` in locale servono:

- `AUTH_SECRET` in `.env.local`;
- migration applicate con `pnpm db:migrate:dev`;
- almeno un admin creato localmente.

Genera `AUTH_SECRET` con:

```bash
openssl rand -base64 32
```

Crea un admin con:

```bash
pnpm admin:create
```

Il comando chiede email e password, normalizza l'email e salva solo l'hash Argon2id nel database. Non usare credenziali reali nei file versionati.

Pagine admin disponibili in locale:

L'area admin ha una shell dedicata con navigazione interna e logout.

- `/admin` dashboard operativa minimale;
- `/admin/segnalazioni` lista segnalazioni da moderare;
- `/admin/segnalazioni/[publicCode]` dettaglio con azioni Approva/Rifiuta.

Pagine pubbliche disponibili in locale:

- `/segnala` invio segnalazione senza account;
- `/segnalazione` tracking tramite codice pubblico;
- `/segnalazioni/[publicCode]` dettaglio pubblico solo per segnalazioni approvate;
- `/mappa` mappa pubblica delle segnalazioni approvate;
- `/manifesto` placeholder manifesto;
- `/notizie` elenco notizie pubblicate;
- `/notizie/[slug]` dettaglio pubblico di una notizia pubblicata;
- `/newsletter` placeholder sezione newsletter;
- `/privacy` placeholder privacy/policy.

Mappa pubblica:

`/mappa` usa MapLibre GL JS. Lo style URL puo essere configurato con `NEXT_PUBLIC_MAP_STYLE_URL`; se non impostato, in locale viene usato lo style raster OpenStreetMap, adatto allo sviluppo ma non scelto come provider definitivo di produzione.

Geocoding nel form segnalazione:

`/segnala` usa un adapter `GeocodingProvider` dietro API route server-side interne. Per l'MVP il provider predefinito e Photon:

```bash
GEOCODING_PROVIDER=photon
PHOTON_GEOCODING_BASE_URL=https://photon.komoot.io
```

Il cittadino non inserisce coordinate manuali: puo cercare un indirizzo, usare la geolocalizzazione del browser o selezionare il punto sulla mini mappa. Se il provider geocoding non risponde, il form resta utilizzabile tramite selezione sulla mappa.

Produzione:

Per l'MVP è prevista una strategia PostgreSQL self-hosted sul VPS già disponibile, con database e utente dedicati, accesso non pubblico quando app e DB sono sullo stesso VPS, backup periodici e restore testabile prima del go-live.

Il progetto non configura Docker.

Upload immagini:

- in sviluppo le foto sono salvate in `.local-storage/report-images`, directory ignorata da Git;
- una segnalazione puo avere al massimo una foto opzionale;
- input supportati: JPEG, PNG, WebP fino a 10 MB;
- le immagini vengono normalizzate a JPEG con `sharp`;
- le foto pending/rejected non sono servite pubblicamente.

PEC, AI e newsletter non sono ancora configurati.

## Esperienza pubblica

La Home pubblica (`/`) e la porta di ingresso dell'MVP: presenta il flusso di segnalazione, i collegamenti principali, metriche aggregate pubbliche, ultime notizie pubblicate, tracking tramite codice, newsletter e ultimi problemi risolti quando disponibili.

La Home riusa application layer e repository esistenti; non carica MapLibre direttamente e non espone metriche interne amministrative.

