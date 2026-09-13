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

`pnpm db:migrate:dev` usa `.env.local`. `pnpm db:seed:dev` inserisce categorie provvisorie di sviluppo, non definitive. Per provare `/segnala` in locale servono migration applicate e almeno una categoria attiva nel database.

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

Produzione:

Per l'MVP è prevista una strategia PostgreSQL self-hosted sul VPS già disponibile, con database e utente dedicati, accesso non pubblico quando app e DB sono sullo stesso VPS, backup periodici e restore testabile prima del go-live.

Il progetto non configura Docker. Storage, PEC, AI e newsletter non sono ancora configurati.
