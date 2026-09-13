# Implementation Plan

Stato: piano tecnico aggiornato dopo revisione.

Questo documento recepisce le decisioni tecniche approvate e mantiene esplicitamente aperte le decisioni non ancora deliberate. Non modifica requisiti di prodotto, business rule o user flow.

## Decisioni tecniche approvate

- Framework: Next.js con App Router e TypeScript.
- Approccio backend: full-stack nello stesso progetto.
- Database: PostgreSQL.
- ORM/query layer: Drizzle.
- Autenticazione: Auth.js solo per amministratori.
- Mappe: MapLibre GL JS.
- Test unitari e di integrazione: Vitest.
- Test end-to-end: Playwright.
- Architettura: moduli applicativi con adapter sostituibili per PEC, storage, AI, newsletter/email e geocoding.
- Deploy MVP: deve poter funzionare su VPS con Node.js senza richiedere Docker.
- Sviluppo locale MVP: standard Node.js, senza Docker come prerequisito.
- Database locale MVP: PostgreSQL locale, preferibilmente tramite Postgres.app su macOS.
- Database produzione MVP: PostgreSQL self-hosted sul VPS gia disponibile.

## Decisioni ancora aperte

Queste decisioni non devono bloccare la progettazione del core, ma vanno risolte prima delle slice che le richiedono:

- storage immagini produzione;
- provider geocoding;
- provider PEC;
- provider newsletter/email;
- provider AI;
- strategia anti-abuso per le conferme;
- retention/log/privacy;
- limiti upload immagini;
- categorie definitive;
- matrice enti e destinatari.

## Sintesi dei vincoli

Visione Comune deve partire come prodotto unico: sito, piattaforma segnalazioni, mappa, backoffice, newsletter e comunicazioni verso enti. L'MVP richiede segnalazioni senza account cittadino, moderazione prima della pubblicazione, codice pubblico univoco, controllo duplicati, conferme senza commenti, stati pubblici `Segnalata`, `Comunicata`, `Risolta`, e predisposizione per PEC, newsletter e AI.

Il sistema deve partire con costi bassi, preferibilmente usando il VPS gia disponibile, ma senza rendere Docker un requisito. Il deploy iniziale deve poter avvenire come applicazione Node.js su VPS, con reverse proxy e process manager da definire in una fase successiva.

Le integrazioni PEC, storage, AI, newsletter/email e geocoding devono passare da adapter sostituibili. Il core deve restare indipendente da un provider specifico.

## Requisiti in conflitto o tensione

Non emergono contraddizioni dirette tra i documenti, ma ci sono tensioni progettuali da gestire esplicitamente:

- Assenza di account cittadini vs anti-abuso sulle conferme. Il sistema deve limitare conferme multiple artificiali senza usare identita forti.
- Nessun dato personale obbligatorio vs tracciamento e moderazione. I log tecnici possono esistere, ma vanno minimizzati e trattati come supporto operativo.
- Costi iniziali minimi vs gestione robusta immagini. Lo storage locale costa meno, ma richiede backup disciplinati e rende piu delicata una migrazione futura.
- Mappa pubblica utile vs rischio caos visivo. Servono filtri, clustering e criteri chiari di visibilita gia dalle prime slice.
- PEC consegnata uguale `Comunicata` vs nessuna presa in carico. L'interfaccia deve evitare qualsiasi testo che faccia percepire `Comunicata` come risolta o accettata dall'ente.
- Deploy semplice su VPS vs operativita. Un deploy Node.js diretto e piu semplice nel breve periodo, ma richiede disciplina su runtime, process manager, log, backup e aggiornamenti.

## Assunzioni rischiose

- Il VPS disponibile ha risorse sufficienti almeno per app Node.js, reverse proxy e gestione operativa minima.
- PostgreSQL locale e stato scelto per la fondazione database; resta da mantenere ripetibile il setup sulle macchine di sviluppo.
- Gli amministratori saranno pochi e possono usare un flusso auth semplice.
- La deduplica iniziale puo essere efficace con regole geografiche e testuali semplici.
- Le integrazioni PEC saranno disponibili in modo automatizzabile e affidabile, ma non devono bloccare l'MVP iniziale.
- Le immagini caricate dai cittadini saranno poche nella fase iniziale.
- La newsletter puo partire in modo separato dal core senza impattare i flussi principali.

## Edge case poco coperti

- Conferme ripetute dallo stesso dispositivo, stessa rete o sessioni diverse.
- Segnalazioni offensive o contenenti dati personali nella descrizione e nelle immagini.
- Richieste di cancellazione o rettifica da parte di cittadini.
- Coordinate fuori area, posizione imprecisa o segnalazione su proprieta privata.
- Codice pubblico condiviso da terzi.
- Upload interrotto o immagine valida ma non processabile.
- Duplicati tra segnalazione non ancora pubblica e nuova segnalazione.
- Ente che risponde senza citare il codice pubblico.
- Comunicazioni verso piu destinatari con esiti diversi.
- Cambio categoria dopo comunicazione gia inviata.
- Risoluzione parziale o contestata.

## Aspetti da mantenere configurabili

- Categorie, destinatari e priorita di smistamento.
- Stati interni di moderazione e comunicazione, mantenendo invariati gli stati pubblici approvati.
- Limiti upload e formati accettati.
- Provider storage.
- Provider PEC.
- Provider newsletter/email.
- Provider AI.
- Provider mappe e geocoding.
- Soglie deduplica.
- Regole anti-abuso.
- Retention di log, allegati, note e comunicazioni.
- Area geografica servita.

## Problemi architetturali da prevenire

- Mescolare logica di dominio in componenti UI o route handler.
- Vincolare il dominio a un provider PEC, storage, AI, newsletter o geocoding.
- Rendere la pubblicazione pubblica un effetto collaterale implicito della creazione.
- Trattare `publicStatus` e `moderationStatus` come un unico stato.
- Gestire allegati e immagini senza metadati e senza strategia di backup.
- Implementare deduplica solo nel frontend.
- Non distinguere eventi pubblici, note interne e comunicazioni amministrative.
- Inserire AI nei flussi decisionali prima di avere audit e revisione umana.
- Rendere Docker necessario prima che sia stato deliberato.

## Confronto stack aggiornato

### 1. Next.js full-stack su VPS con Node.js

Descrizione: applicazione Next.js unica, con backend applicativo nello stesso progetto, deploy iniziale su VPS come applicazione Node.js. PostgreSQL e locale in sviluppo e self-hosted sul VPS in produzione per l'MVP, mantenendo `DATABASE_URL` come unico contratto applicativo.

Vantaggi:

- Sviluppo locale semplice: un unico progetto, un unico linguaggio, un solo repository.
- Buona compatibilita con lavoro agentico: file, moduli e test restano vicini.
- Costi iniziali bassi se si usa il VPS disponibile.
- Deploy coerente con infrastruttura gia disponibile.
- Docker non e richiesto per sviluppare o deployare l'MVP.
- Debug piu diretto rispetto a una distribuzione serverless.
- Migrazione futura possibile verso Docker o backend separato, se i confini vengono rispettati.

Svantaggi:

- Il VPS richiede gestione operativa: runtime Node.js, process manager, reverse proxy, log, backup e aggiornamenti.
- Richiede disciplina operativa su PostgreSQL locale e self-hosted: backup, restore, monitoring e aggiornamenti.
- Storage immagini e backup non sono risolti automaticamente.

Valutazione: opzione consigliata per l'MVP.

### 2. Next.js con database/backend gestiti tramite servizi esterni

Descrizione: frontend/backend Next.js, database gestito tipo Supabase/Neon, storage gestito, auth gestita o parzialmente gestita.

Vantaggi:

- Meno operativita su database, backup e storage.
- Avvio veloce per team piccolo.
- Buoni strumenti amministrativi per dati e log.
- Scalabilita iniziale piu semplice.

Svantaggi:

- Costi e limiti possono crescere con uso reale.
- Rischio vendor lock-in se si usano feature proprietarie oltre PostgreSQL standard.
- Debug distribuito tra VPS/app e provider esterni.
- Auth gestita per soli admin puo essere piu di quanto serve.

Valutazione: opzione valida per ridurre carico operativo su database/storage, senza cambiare il core se si resta su PostgreSQL standard e adapter.

### 3. Next.js frontend con backend separato

Descrizione: frontend Next.js separato da API backend, ad esempio Node/Fastify/NestJS o altro servizio.

Vantaggi:

- Confini netti tra frontend e backend.
- Possibile scalare separatamente.
- Integrazioni PEC, AI e newsletter isolate in un servizio dedicato.

Svantaggi:

- Maggiore complessita iniziale.
- Due deploy, due ambienti, piu coordinamento.
- Piu superficie di test e debug.
- Meno adatto alla fase MVP con costi minimi e sviluppo rapido.

Valutazione: non consigliato per partire. Ha senso come evoluzione se backoffice, integrazioni o traffico richiederanno processi separati.

### 4. Next.js full-stack con Docker

Descrizione: stessa architettura full-stack, ma impacchettata con container.

Vantaggi:

- Ambiente ripetibile.
- Deploy piu standardizzato se il VPS sara preparato per container.
- Utile per produzione futura o per allineare sviluppo e deploy.

Svantaggi:

- Non e stato deliberato.
- Aggiunge complessita operativa iniziale.
- Non deve essere un prerequisito per MVP.

Valutazione: opzione futura, non vincolo attuale.

## Stack approvato e raccomandazioni operative

### Framework frontend

Next.js con App Router e TypeScript.

Motivo: consente sito pubblico, backoffice, pagine dinamiche, API interne e rendering server-side in un solo progetto.

### Approccio backend

Backend applicativo nello stesso progetto Next.js, organizzato in application services e route handler. I route handler devono essere sottili: validano input, chiamano servizi applicativi e restituiscono risposte.

### Database

PostgreSQL.

Decisione MVP: PostgreSQL locale in sviluppo, preferibilmente tramite Postgres.app su macOS, e PostgreSQL self-hosted sul VPS in produzione. Il core deve continuare a dipendere solo da `DATABASE_URL` o `TEST_DATABASE_URL`, non dal modo in cui il database e ospitato.

### ORM o query layer

Drizzle ORM, con migration versionate tramite Drizzle Kit da introdurre nella slice di fondazione database.

### Storage immagini

Adapter `StorageProvider` con implementazione locale per sviluppo e provider produzione da definire.

### Autenticazione amministratori

Auth.js per sessioni admin. Nell'MVP viene usato un provider Credentials con email e password locali, admin persistiti in `admin_users`, password salvate solo come hash Argon2id e sessioni JWT di durata esplicita. I cittadini restano senza account.

### Mappe e geocoding

MapLibre GL JS per la mappa. Il provider tile/geocoding resta configurabile e da definire.

### Validazione dati

Zod e consigliato per validazione runtime condivisa tra form, route handler e application services.

### Testing

Vitest per domain logic, application services e integration test. Playwright per i flussi reali: nuova segnalazione, duplicato, moderazione, pubblicazione, conferma, tracking codice e backoffice.

### Logging e gestione errori

Logging strutturato server-side con livelli configurabili. Per iniziare: log leggibili da stdout/stderr e compatibili con process manager su VPS. Gli errori di dominio devono essere tipizzati, con messaggi utente non tecnici e log interni con contesto operativo.

### Strategia di deploy

Deploy iniziale previsto su VPS come applicazione Node.js:

- build Next.js;
- avvio tramite process manager da definire;
- reverse proxy da definire;
- variabili ambiente sul server;
- PostgreSQL self-hosted sullo stesso VPS o su host privato controllato;
- utente database dedicato e database dedicato;
- accesso PostgreSQL non esposto pubblicamente se app e DB sono sullo stesso VPS;
- backup periodici, copia esterna e restore testabile;
- aggiornamenti PostgreSQL e monitoring da predisporre prima del go-live;
- backup storage secondo la decisione futura sul provider immagini.

Docker resta opzione futura e non deve essere introdotto in questa fase.

### Variabili d'ambiente

`.env.example` versionato, `.env` escluso da Git, validazione env all'avvio con schema dedicato.

### Backup

Backup giornaliero PostgreSQL, retention definita, copia offsite e restore testato periodicamente. Per immagini: strategia dipendente dallo storage produzione scelto.

### Integrazione PEC futura

Modulo `communications` con porta `PecProvider`.

Fase 1: predisposizione manuale o semi-manuale, registrando invio, destinatario, stato e allegati.

Fase 2: adapter SMTP/IMAP o API provider per invio, ricevute e delivery status.

Fase 3: riconciliazione inbound tramite `externalMessageId`, codice pubblico nel subject/body e revisione admin.

La PEC puo essere rimandata finche il core registra correttamente comunicazioni e stati.

### Provider AI futuro

Porta `AiProvider` con funzioni limitate e non decisionali: suggerire categoria, destinatario, possibile presenza di dati personali, duplicati o riassunti operativi. Ogni output AI deve restare bozza o suggerimento approvato da admin.

### Newsletter/email futura

Porta `NewsletterProvider` separata dal dominio segnalazioni. Il core deve pubblicare eventi applicativi o viste approvate, non parlare direttamente con un vendor.

## VC-004 — Creazione segnalazione anonima

Il primo flusso reale usa una pagina pubblica `/segnala` e una Server Action che chiama `CreateReportUseCase`. La separazione resta:

`UI -> Server Action -> application service -> dominio -> repository -> PostgreSQL`

Scelte operative:

- categorie lette dal database tramite repository categorie;
- seed di sviluppo con categorie provvisorie marcate come tali;
- nessun account cittadino e nessun dato personale obbligatorio;
- titolo derivato da categoria e localizzazione/testo;
- indirizzo testuale + Geolocation API opzionale;
- latitudine/longitudine come fallback temporaneo finche non saranno introdotti geocoding e mappa;
- generazione server-side di `publicCode` casuale leggibile con retry su collisione;
- stato iniziale sempre `pending_review` e non pubblico.

La conversione indirizzo-coordinate resta fuori scope e dovra essere risolta in una vertical slice successiva, insieme alla UX definitiva della mappa/geocoding.

## VC-005 — Autenticazione amministratori

L'area `/admin` e protetta server-side con Auth.js. La separazione resta:

`UI admin -> Server Action/Auth.js -> application service admin -> repository admin -> PostgreSQL`

Scelte operative:

- login dedicato `/admin/login` con email e password;
- route Auth.js sotto `/api/auth/[...nextauth]`;
- sessione Auth.js basata su JWT con durata di 8 ore;
- password hash Argon2id tramite API crypto native di Node.js;
- tabella `admin_users` con email normalizzata, hash password, ruolo, flag `active` e timestamp;
- comando CLI `pnpm admin:create` per creare il primo admin senza UI di gestione utenti;
- nessuna password in chiaro in database, log, sessione o documentazione;
- controllo server-side su `/admin` per verificare che l'admin della sessione esista ancora e sia attivo;
- messaggi di errore login generici, senza distinguere email inesistente, password errata o admin disattivato.

Gestione admin inattivo:

- `authenticateAdminWithPassword` accetta solo admin attivi;
- `/admin` ricarica l'utente dal database usando l'id in sessione;
- se l'admin e stato disattivato dopo il login, l'accesso al backoffice viene negato e l'utente viene rimandato al login.

Restano fuori scope:

- gestione admin da UI;
- ruoli granulari;
- recupero password;
- MFA;
- audit completo degli accessi.

## Ambiente PostgreSQL locale

La fondazione database usa due database locali separati:

- `visione_comune_dev` per sviluppo e migration manuali;
- `visione_comune_test` per integration test PostgreSQL.

Le variabili locali sono:

- `DATABASE_URL` in `.env.local`;
- `TEST_DATABASE_URL` in `.env.test.local`.

I file `.env.local` e `.env.test.local` sono ignorati da Git. `.env.example` contiene solo placeholder.

Script utili:

- `pnpm db:migrate:dev` applica le migration al database indicato in `.env.local`;
- `pnpm test:integration` esegue gli integration test PostgreSQL usando `.env.test.local`.

Gli integration test devono usare fixture minime, categorie di test e cleanup dei soli record creati dai test. Non devono cancellare lo schema `public` o dati non appartenenti ai test.

## Architettura proposta

Struttura iniziale da creare solo dopo approvazione della prima task implementativa:

```text
.
├── docs/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   ├── admin/
│   │   └── api/
│   ├── modules/
│   │   ├── reports/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── tests/
│   │   ├── moderation/
│   │   ├── confirmations/
│   │   ├── communications/
│   │   ├── categories/
│   │   ├── recipients/
│   │   ├── map/
│   │   ├── admin/
│   │   └── auth/
│   ├── shared/
│   │   ├── config/
│   │   ├── db/
│   │   ├── errors/
│   │   ├── logging/
│   │   ├── validation/
│   │   └── ui/
│   └── providers/
│       ├── storage/
│       ├── pec/
│       ├── newsletter/
│       ├── geocoding/
│       └── ai/
├── drizzle/
└── tests/
    ├── integration/
    └── e2e/
```

Principi:

- `modules/*/domain` contiene regole pure e testabili.
- `modules/*/application` orchestra casi d'uso.
- `modules/*/infrastructure` contiene repository e adapter concreti.
- `providers/*` contiene interfacce e implementazioni per servizi sostituibili.
- `src/app` non contiene business rule critiche.
- Stati pubblici e transizioni devono stare in un modulo centralizzato.
- Timeline, note interne e comunicazioni devono restare concetti separati.
- Nessuna directory o configurazione Docker finche Docker non viene approvato.

## Strategia di sviluppo

La roadmap dettagliata e mantenuta in `docs/ROADMAP.md`.

L'ordine consigliato punta a raggiungere rapidamente una prima vertical slice funzionante:

1. bootstrap tecnico Node.js/Next.js;
2. fondazione dominio e database;
3. creazione segnalazione non pubblica;
4. moderazione admin;
5. pubblicazione e dettaglio pubblico;
6. tracking tramite codice;
7. mappa;
8. conferme;
9. duplicati;
10. comunicazioni e integrazioni future.

PEC, AI e newsletter non devono bloccare le prime slice: vanno isolate con adapter e implementate quando le decisioni provider saranno pronte.
