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

## VC-006 — Moderazione amministratori

Il primo backoffice operativo permette a un admin autenticato e attivo di vedere le segnalazioni `pending_review`, aprirne il dettaglio e approvarle o rifiutarle.

La separazione resta:

`UI admin -> Server Action -> application use case -> dominio Report -> repository -> PostgreSQL`

Scelte operative:

- `/admin` mostra il conteggio delle segnalazioni da verificare e le ultime pending;
- `/admin/segnalazioni` mostra lista e filtri semplici: da verificare, approvate, rifiutate, tutte;
- `/admin/segnalazioni/[publicCode]` mostra descrizione, categoria, indirizzo, coordinate, stato e azioni di moderazione;
- `ApproveReportUseCase` e `RejectReportUseCase` applicano le transizioni tramite `Report.approve` e `Report.reject`;
- `ReportApproved` e `ReportRejected` vengono persistiti in `report_events`;
- la nota interna opzionale di rifiuto viene salvata come `metadata.internalNote` su `ReportRejected`;
- il repository salva la moderazione solo se lo stato precedente e ancora `pending_review`, cosi una doppia moderazione concorrente produce errore controllato;
- le Server Action admin verificano sempre la sessione e l'admin attivo lato server.

Restano fuori scope:

- comunicazione agli enti, PEC, stato `Comunicata` e stato `Risolta`;
- modifica completa dei contenuti e gestione categorie da UI.

## VC-007 — Dettaglio pubblico e tracking tramite codice

Il tracking pubblico usa `/segnalazione` come pagina di ricerca codice e `/segnalazioni/[publicCode]` come route stabile della scheda pubblica approvata.

La separazione resta:

`UI pubblica -> application use case -> repository -> PostgreSQL`

Scelte operative:

- `TrackReportByPublicCodeUseCase` distingue codice invalido, non trovato, pending, rejected e published;
- `GetPublicReportUseCase` restituisce solo segnalazioni approvate con stato pubblico;
- `GetPublicReportTimelineUseCase` restituisce solo eventi pubblici ordinati;
- la pagina tracking mostra messaggi comprensibili per pending, rejected, not found e invalid code;
- se il codice appartiene a una segnalazione pubblicata, il tracking porta alla scheda pubblica;
- la scheda pubblica mostra codice pubblico, titolo, descrizione, categoria, indirizzo, coordinate testuali, stato pubblico, data invio, data pubblicazione e timeline pubblica;
- eventi interni, metadata e note di rifiuto non vengono restituiti al pubblico;
- la conferma di invio segnalazione include CTA verso il tracking.

Restano fuori scope:

- mappa pubblica;
- geocoding;
- foto;
- conferme;
- duplicati;
- PEC e destinatari;
- stati `Comunicata` e `Risolta` come flussi operativi nuovi.


## VC-008 — Mappa pubblica delle segnalazioni

La mappa pubblica usa `/mappa` e mostra solo segnalazioni approvate con stato pubblico. La separazione resta:

`UI pubblica -> application use case -> repository -> PostgreSQL`

Scelte operative:

- `ListPublicReportsForMapUseCase` restituisce il payload minimo necessario alla mappa;
- il repository espone `listPublicForMap()` e filtra nel database `moderationStatus = approved`, `publicStatus` non nullo e `publishedAt` non nullo;
- il payload pubblico contiene solo `publicCode`, titolo, categoria, latitude, longitude, address opzionale, `publicStatus`, label stato e `publishedAt`;
- la UI usa MapLibre GL JS in un client component isolato, mentre la pagina server recupera i dati dal layer applicativo;
- la mappa parte centrata su Venafro;
- sono disponibili filtri client-side semplici per stato e categoria sui soli dati gia pubblici;
- la lista accessibile sotto la mappa mostra gli stessi report visibili e consente di aprire `/segnalazioni/[publicCode]`;
- lo style URL si configura con `NEXT_PUBLIC_MAP_STYLE_URL`; il fallback raster OpenStreetMap e solo per sviluppo locale.

Restano fuori scope:

- geocoding e reverse geocoding;
- provider tile definitivo di produzione;
- clustering avanzato, heatmap e ricerca avanzata;
- upload foto;
- conferme e duplicati;
- PEC, destinatari, AI e newsletter;
- transizioni operative verso `Comunicata` e `Risolta`.

Rischi residui:

- il provider tile definitivo richiedera una decisione su licenze, attribution, limiti e costi;
- senza geocoding, la qualita della mappa dipende dalle coordinate raccolte in fase di creazione;
- con molti report serviranno clustering o strategie di semplificazione visuale.


## VC-009 — Upload immagini moderabile

Il form `/segnala` accetta una foto opzionale, massimo una per segnalazione. La separazione resta:

`UI -> Server Action -> application use case -> image validation/normalization -> StorageProvider -> repository -> PostgreSQL`

Scelte operative:

- input accettati: JPEG, PNG, WebP fino a 10 MB;
- validazione server-side con controllo magic bytes e processamento immagine;
- normalizzazione con `sharp`: output JPEG, qualita 82, lato lungo massimo 2200 px, nessun upscaling;
- EXIF/metadati non vengono preservati;
- storage locale di sviluppo tramite `LocalStorageProvider` in `.local-storage/report-images`;
- filename/storage key generati server-side, senza usare il nome file utente;
- tabella `report_attachments` con un allegato immagine massimo per report;
- route admin protetta per vedere la foto durante la moderazione;
- route pubblica `/api/report-images/[publicCode]` che serve la foto solo se il report e approvato e pubblico;
- cleanup compensativo del file se il salvataggio database fallisce dopo storage.

Restano fuori scope:

- piu foto, galleria, upload admin o foto aggiunte da altri cittadini;
- provider storage produzione definitivo, CDN e media library;
- scansione antivirus avanzata;
- OCR, AI vision, crop/editor immagini;
- policy automatica di retention.

Retention MVP documentata:

- pending: foto conservata internamente e visibile agli admin;
- approved: foto conservata e servibile pubblicamente;
- rejected: foto conservata internamente per audit/moderazione, non pubblica.

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

## VC-010 — Rilevamento duplicati iniziale

Il controllo duplicati viene integrato nel flusso `/segnala` prima della creazione definitiva del report. La separazione resta:

`UI pubblica -> application use case -> repository -> PostgreSQL`

Configurazione iniziale:

- stessa categoria;
- distanza massima 100 metri;
- finestra temporale 90 giorni;
- solo report `approved` con stato pubblico e `publishedAt`;
- massimo 5 candidati mostrati, con limite interno di query piu alto;
- distanza precisa calcolata con formula Haversine;
- nessuna AI, embedding, PostGIS o confronto immagini.

Il repository filtra nel database per categoria, stato pubblico, finestra temporale e bounding box geografico, evitando di caricare tutte le segnalazioni. Il use case `FindPotentialDuplicateReportsUseCase` calcola la distanza precisa, ordina i candidati per distanza e poi per recenza, e restituisce solo dati pubblici: codice pubblico, titolo, categoria, indirizzo, stato, distanza stimata e data pubblicazione.

Nel form pubblico, se vengono trovati candidati, l'utente vede una sezione `Potrebbe esistere gia una segnalazione simile` con link alla scheda pubblica. Se il problema e diverso, puo proseguire esplicitamente con `Il mio problema e diverso, continua`; la creazione non viene bloccata. La conferma persistente della segnalazione esistente resta fuori scope e appartiene a VC-011.

Limite noto: se era stata selezionata una foto e compare lo step duplicati, il browser puo perdere il file input dopo il roundtrip. La UI avvisa di riselezionare la foto prima di continuare.

## VC-011 — Conferme segnalazione

Le conferme vengono implementate come modello persistente separato `report_confirmations` collegato a `reports`. La separazione resta:

`UI pubblica -> Server Action -> application use case -> repository -> PostgreSQL`

Scelte MVP:

- conferma ammessa solo su report approvati e pubblici;
- input client limitato al `publicCode`; il report viene riletto lato server;
- cookie first-party anonimo `vc_report_confirmation_id`, HttpOnly, SameSite=Lax, durata 180 giorni;
- database con `antiAbuseKey` derivata dal cookie tramite SHA-256;
- vincolo univoco `(reportId, antiAbuseKey)`;
- conteggio pubblico solo aggregato;
- nessun commento, voto, ranking, upload aggiuntivo o dato personale obbligatorio.

Limite noto: la strategia impedisce doppio click e ripetizioni banali dallo stesso browser, ma non impedisce nuove conferme da browser, dispositivi o profili diversi. Non introduce fingerprinting aggressivo.

## VC-012 — Gestione categorie

La gestione categorie viene implementata come modulo applicativo dedicato sopra la tabella `categories` gia presente. La separazione resta:

`UI admin -> Server Action autenticata -> application use case -> CategoryRepository -> PostgreSQL`

Scelte MVP:

- route admin `/admin/categorie`, `/admin/categorie/nuova`, `/admin/categorie/[categoryId]`;
- ogni Server Action verifica `requireActiveAdmin`;
- use case espliciti `ListCategoriesUseCase`, `CreateCategoryUseCase`, `UpdateCategoryUseCase`, `SetCategoryActiveStateUseCase`;
- validazione server-side di nome, slug e stato;
- slug normalizzato lowercase URL-safe e protetto da vincolo univoco database;
- nessun hard delete;
- `active=false` esclude la categoria da `/segnala`, mentre i report storici continuano a leggerla via FK;
- il conteggio report nella lista admin e informativo e non introduce ranking pubblico.

Restano fuori scope gerarchie, icone, colori, drag and drop, bulk edit, destinatari, matrice enti e categorie definitive.

## VC-013 — Destinatari e matrice di smistamento

La matrice destinatari viene implementata senza inviare comunicazioni. La separazione resta:

`UI admin -> Server Action autenticata -> application use case -> repository -> PostgreSQL`

Scelte MVP:

- route admin `/admin/destinatari` per lista, creazione, modifica e attivazione/disattivazione;
- route admin `/admin/smistamento` per associare categorie e destinatari;
- modello `recipients` con nome, organizzazione, email opzionale, PEC opzionale, stato e timestamp;
- modello `category_recipients` many-to-many con `sortOrder`;
- `sortOrder = 0` rappresenta il destinatario principale per una categoria;
- i destinatari disattivati restano configurabili/storici ma sono esclusi dai suggerimenti operativi;
- il dettaglio admin report mostra solo suggerimenti in lettura;
- nessun invio PEC/email, stato `Comunicata`, ricevuta o automazione viene introdotta.

Limite noto: la validazione PEC e solo sintattica. La scelta provider PEC/email e il workflow di consegna restano rimandati a VC-015/VC-019.


## VC-014 — Timeline completa

La timeline delle segnalazioni e ora consolidata attorno a `report_events` e a use case applicativi dedicati. Non sono state introdotte nuove funzionalita di comunicazione, PEC o risoluzione.

La separazione resta:

`UI -> application timeline use case -> repository timeline -> PostgreSQL`

Scelte MVP:

- `report_events` resta lo schema di riferimento: `id`, `reportId`, `type`, `visibility`, `publicStatus`, `metadata`, `createdAt`;
- nessuna migration aggiuntiva per VC-014: lo schema esistente copre gli eventi richiesti;
- gli eventi sono ordinati per `createdAt ASC` e poi `id ASC`;
- la timeline pubblica legge solo eventi `visibility = public` e restituisce item gia presentazionali: label, descrizione, data;
- la timeline admin legge eventi pubblici e interni e mostra badge `Pubblico` / `Interno`, nota interna e metadata conosciuti;
- la mappatura `event type -> label -> descrizione -> visibilita attesa` e centralizzata nel layer applicativo;
- `ReportCreated` resta interno e non compare nella scheda pubblica;
- `ReportApproved` e pubblico e rappresenta l'inizio dello storico visibile al cittadino;
- `ReportRejected` resta interno e puo mostrare in admin `metadata.internalNote`;
- metadata e note non vengono esposti in viste pubbliche;
- eventi futuri di comunicazione, consegna, fallimento, risposta e promemoria sono documentati ma non implementati.

Restano fuori scope:

- invio o registrazione manuale di comunicazioni;
- PEC/email;
- cambio stato `Comunicata`;
- cambio stato `Risolta`;
- sistema generico di note interne indipendente dagli eventi.


## VC-015 — Comunicazioni manuali

Le comunicazioni sono registrate manualmente dal backoffice senza invio PEC/email reale. La separazione resta:

`UI admin -> Server Action autenticata -> application use case -> dominio Report -> repository comunicazioni/report -> PostgreSQL`

Scelte MVP:

- nuova tabella `outbound_communications` con riferimento al report, riferimento opzionale al destinatario e snapshot del destinatario;
- canali supportati: `email`, `pec`;
- stati supportati: `draft`, `sent`, `delivered`, `failed`;
- il template oggetto/testo e deterministico e generato nel layer applicativo usando codice, categoria, luogo, data, descrizione e link pubblico;
- registrare una comunicazione come `sent` crea solo evento interno `CommunicationSent` e non cambia stato report;
- `delivered` valorizza `deliveredAt`, crea evento interno `CommunicationDelivered` e, se il report e ancora `Segnalata`, passa dal dominio `Report.markCommunicated`;
- il passaggio a `Comunicata` crea evento pubblico `ReportCommunicated`;
- `failed` valorizza `failedAt`, crea evento interno `CommunicationFailed` e non cambia stato report;
- la scheda pubblica non mostra destinatario, indirizzi, oggetto, corpo o dettagli tecnici;
- doppio delivered sequenziale e gestito in modo idempotente senza duplicare `ReportCommunicated`;
- una seconda comunicazione consegnata su report gia `Comunicata` non duplica l'evento pubblico.

Restano fuori scope:

- invio SMTP o PEC reale;
- provider PEC/email;
- inbox, ricevute automatiche, reply matching e solleciti;
- AI o routing automatico.

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


## VC-016 — Risoluzione segnalazione

Implementazione prevista/completata per la slice:

- use case applicativo `ResolveReportUseCase` nel modulo `reports`;
- transizione sempre tramite `Report.markResolved`, senza update diretto degli stati dal layer UI o infrastruttura;
- salvataggio con stato atteso `approved` + `communicated` per intercettare doppio click o modifiche concorrenti;
- CTA admin `Segna come risolta` visibile solo su report `Comunicata`;
- conferma browser prima della submit per evitare azioni accidentali;
- nota interna opzionale salvata come `metadata.internalNote` sull'evento pubblico `ReportResolved`;
- timeline pubblica con evento `Problema risolto` senza metadata;
- timeline admin con nota interna separata;
- pagina pubblica con stato `Risolta` e data risoluzione;
- mappa pubblica mantiene i report risolti visibili e filtrabili per stato `Risolta`.

Restano fuori scope: riapertura, regressione di stato, solleciti, PEC reale, email reale, risposta cittadino o prova fotografica di risoluzione.

## VC-016B — App shell e navigazione

Implementazione prevista/completata per la slice:

- shell pubblica globale nel root layout, nascosta per le route `/admin`;
- header pubblico riutilizzabile con stato attivo e CTA `Segnala un problema`;
- menu mobile accessibile senza librerie esterne;
- footer pubblico con link principali, area contatti placeholder e privacy placeholder;
- shell admin sotto `/admin/layout.tsx`, mostrata solo con sessione admin attiva;
- navigazione admin per Dashboard, Segnalazioni, Categorie, Notizie, Destinatari e Smistamento;
- home temporanea semplificata con CTA verso segnalazione e mappa;
- placeholder `/newsletter` e `/privacy` senza form o provider esterni;
- test E2E per navigazione pubblica, mobile e admin.

Restano fuori scope: home editoriale definitiva, form newsletter, provider email/newsletter, ricerca globale e dashboard statistiche avanzate.

## VC-017 — Notizie e aggiornamenti

Implementazione prevista/completata per la slice:

- modello `news_posts` con `draft` e `published`;
- slug URL-safe, lowercase, univoco, generabile dal titolo e modificabile dall'admin;
- contenuto testuale semplice, senza Markdown, HTML raw o editor WYSIWYG;
- use case applicativi per lista admin, creazione, modifica, lista pubblica e dettaglio pubblico;
- repository Drizzle dedicato sotto `modules/news/infrastructure`;
- backoffice `/admin/notizie`, `/admin/notizie/nuova`, `/admin/notizie/[postId]`;
- lista pubblica `/notizie` e dettaglio `/notizie/[slug]`;
- bozze escluse dalla lista pubblica e 404 su accesso diretto allo slug;
- `publishedAt` valorizzato alla prima pubblicazione e conservato se il post torna bozza;
- navigazione admin aggiornata con `Notizie`;
- test unit, integration e E2E dedicati.

Restano fuori scope: categorie/tag news, autore pubblico, immagini copertina, SEO avanzata, scheduling, revision history, newsletter automatica e notifiche.

## Aggiornamento VC-021B — Geocoding e posizione

La selezione posizione e stata portata fuori dai campi tecnici manuali. L'architettura segue il confine:

`UI /segnala → API route applicative → GeocodingProvider → provider esterno`

Scelta MVP:

- adapter `GeocodingProvider` con operazioni `searchAddress` e `reverseGeocode`;
- implementazione iniziale `PhotonGeocodingProvider`;
- richieste geocoding mediate da `/api/geocoding/search` e `/api/geocoding/reverse`;
- bias geografico verso Venafro tramite coordinate centrali gia usate dalla mappa;
- nessun geofence rigido.

La UI usa debounce, soglia minima di 3 caratteri e massimo 5 risultati. La posizione finale viene inviata al dominio come coordinate interne, mantenendo compatibile `CreateReportUseCase` e il rilevamento duplicati VC-010.

Limite operativo:
il servizio pubblico Photon va bene per MVP e sviluppo con carico basso. Prima della produzione con traffico significativo va rivalutata la policy d'uso e, se necessario, un provider con piano dedicato o un'istanza self-hosted.
