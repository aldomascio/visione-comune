# Decisions

## APPROVATO

### ADR-001 — Nessun account cittadino

Decisione:
i cittadini non avranno account.

Motivo:
ridurre la frizione e non richiedere dati identificativi.

Conseguenza:
il tracking avviene tramite codice univoco.

### ADR-002 — Stati pubblici

Decisione:
`Segnalata → Comunicata → Risolta`

Motivo:
evitare di dichiarare una presa in carico che non può essere provata.

### ADR-003 — Moderazione prima della pubblicazione

Decisione:
nessuna segnalazione viene pubblicata automaticamente.

### ADR-004 — Conferma senza discussione

Decisione:
gli utenti possono confermare un problema, ma non commentare o aggiungere foto.

### ADR-005 — AI non autonoma nell'MVP

Decisione:
l'AI suggerisce, l'operatore verifica.

### ADR-006 — Architettura modulare

Decisione:
PEC, newsletter/email, storage, geocoding e AI devono essere implementati tramite adapter sostituibili.

### ADR-007 — Infrastruttura minima iniziale

Decisione:
partire con risorse già disponibili o gratuite quando sensato, evitando sovradimensionamento.

### ADR-008 — Stack applicativo

Decisione:
usare Next.js con App Router e TypeScript, con approccio full-stack nello stesso progetto.

Motivo:
mantiene semplice lo sviluppo locale, riduce la complessita iniziale e permette di tenere vicini UI, backend applicativo e test.

### ADR-009 — Database e query layer

Decisione:
usare PostgreSQL come database relazionale e Drizzle come ORM/query layer.

Motivo:
PostgreSQL e adatto a dati relazionali, audit, timeline, comunicazioni e possibili esigenze geografiche future. Drizzle mantiene schema e query espliciti in TypeScript.

### ADR-010 — Autenticazione amministratori

Decisione:
usare Auth.js per autenticazione riservata agli amministratori.

Conseguenza:
i cittadini restano senza account, come previsto da ADR-001.

### ADR-011 — Mappe

Decisione:
usare MapLibre GL JS per la mappa.

Motivo:
e una libreria open source, compatibile con TypeScript e con provider tile/geocoding configurabili.

### ADR-012 — Test

Decisione:
usare Vitest per test unitari e di integrazione, e Playwright per test end-to-end.

Motivo:
coprono rispettivamente regole di dominio, integrazioni applicative e flussi utente reali.

### ADR-013 — Docker non richiesto per MVP

Decisione:
Docker non e un requisito per l'MVP. Il progetto deve poter essere sviluppato e deployato anche senza Docker.

Conseguenza:
lo sviluppo locale parte con Node.js standard; il deploy iniziale su VPS deve poter usare Node.js. Docker resta una possibile opzione futura, non un vincolo.

### ADR-014 — Risoluzione dopo comunicazione

Decisione:
una segnalazione puo passare allo stato pubblico `Risolta` solo dopo essere stata almeno `Comunicata`.

Motivo:
la risoluzione richiede verifica di Visione Comune e deve seguire una segnalazione gia pubblicata e comunicata, evitando salti di stato incoerenti nella timeline pubblica.

### ADR-015 — Unicita codice pubblico

Decisione:
il value object `PublicCode` valida il formato `VC-XXXXXXXX`, mentre l'unicita e garantita dal database tramite vincolo unique su `reports.public_code`.

Motivo:
il dominio resta indipendente dalla persistenza; eventuali collisioni di generazione saranno gestite esplicitamente dal layer applicativo/persistenza quando verra implementato il flusso di creazione.

Conseguenza:
la strategia definitiva di generazione del codice pubblico resta fuori da VC-003 e verra completata nella vertical slice di creazione segnalazione.


### ADR-016 — PostgreSQL locale e produzione self-hosted

Decisione:
per l'MVP lo sviluppo locale usa PostgreSQL locale, preferibilmente tramite Postgres.app su macOS. La produzione usera PostgreSQL self-hosted sul VPS gia disponibile.

Motivo:
questa scelta mantiene bassi i costi iniziali, resta coerente con il deploy su VPS e non introduce dipendenze da servizi managed nella fase MVP.

Conseguenza:
il codice applicativo deve continuare a dipendere solo da `DATABASE_URL` o `TEST_DATABASE_URL`, senza assumere Postgres.app, Homebrew, VPS o uno specifico provider. Un database managed resta possibile in futuro senza riscrivere dominio o repository.

### ADR-017 — Creazione segnalazione anonima

Decisione:
il primo flusso di creazione segnalazione usa una Server Action Next.js che chiama un application service dedicato. Il cittadino non deve creare account e non vengono richiesti nome, cognome, email o telefono.

Motivo:
la Server Action mantiene la mutazione lato server, permette validazione server-side e restituisce errori comprensibili al form senza esporre dettagli di database o infrastruttura.

Conseguenza:
la UI non conosce Drizzle e non crea direttamente entita di dominio. La segnalazione nasce con `moderationStatus = pending_review` e senza stato pubblico.

### ADR-018 — Codice pubblico casuale leggibile

Decisione:
il codice pubblico viene generato lato server nel formato `VC-XXXXXXXX`, con 8 caratteri casuali non sequenziali presi da un alfabeto leggibile che esclude `0`, `O`, `1`, `I` e `L`.

Motivo:
riduce errori di lettura e impedisce di dedurre il volume o l'ordine delle segnalazioni.

Conseguenza:
l'unicita resta garantita dal vincolo database; il caso di collisione viene gestito con retry automatico e limite esplicito.

### ADR-019 — Categorie provvisorie per VC-004

Decisione:
per VC-004 il form legge le categorie attive dal database. Le categorie iniziali sono seed provvisori marcati come tali e non rappresentano la tassonomia definitiva del progetto.

Motivo:
il flusso end-to-end richiede categorie selezionabili, ma le categorie definitive sono ancora da deliberare.

Conseguenza:
la gestione completa categorie resta nelle vertical slice successive.

### ADR-020 — Posizione temporanea senza geocoding

Decisione:
in VC-004 il form chiede un indirizzo testuale e offre un pulsante opzionale `Usa la mia posizione` basato su Geolocation API. Latitudine e longitudine restano disponibili come campi temporanei per completare il dato richiesto dal dominio e dal database.

Motivo:
geocoding, reverse geocoding e mappa interattiva sono fuori scope, ma la segnalazione deve comunque avere coordinate persistibili.

Conseguenza:
la conversione indirizzo-coordinate verra gestita in una task successiva; il form resta utilizzabile anche se la geolocalizzazione viene negata o fallisce.

### ADR-021 — Titolo segnalazione derivato

Decisione:
il cittadino non inserisce un titolo separato in VC-004. Il titolo viene derivato deterministicamente da categoria e indirizzo, o da categoria e inizio descrizione quando l'indirizzo manca.

Motivo:
riduce attrito nel form pubblico mantenendo compatibilita con il dominio `Report`, che richiede un titolo.

Conseguenza:
il titolo potra essere rivisto in moderazione quando sara disponibile il backoffice.

### ADR-022 — Autenticazione admin con credenziali locali

Decisione:
per l'MVP l'area `/admin` usa Auth.js con provider Credentials, email e password per soli amministratori. Gli admin sono persistiti nella tabella `admin_users`; le password sono salvate solo come hash Argon2id e non devono comparire in log, sessione o risposte applicative.

Motivo:
permette di proteggere il backoffice senza introdurre account cittadini, OAuth o provider email ancora non deliberati.

Conseguenza:
la creazione iniziale degli admin avviene tramite comando CLI locale `pnpm admin:create`. Le sessioni usano JWT Auth.js con durata esplicita di 8 ore. Le pagine admin verificano server-side che l'utente esista ancora e sia attivo, cosi un admin disattivato non puo continuare a usare il backoffice anche se possiede un token precedente.

### ADR-023 — Moderazione admin tramite dominio Report

Decisione:
la moderazione amministrativa approva o rifiuta una segnalazione passando sempre dal dominio `Report`. Le Server Action admin verificano la sessione server-side, chiamano use case applicativi e non aggiornano direttamente gli stati nel database.

Motivo:
mantiene centralizzate le business rule su pubblicazione, stati e transizioni, evitando scorciatoie nella UI o nelle action.

Conseguenza:
approvare imposta `moderationStatus = approved`, `publicStatus = reported`, `publishedAt` e persiste `ReportApproved`. Rifiutare imposta `moderationStatus = rejected`, lascia la segnalazione non pubblica e persiste `ReportRejected`. Il salvataggio di moderazione usa lo stato atteso `pending_review` per intercettare doppie moderazioni concorrenti.

### ADR-024 — Tracking pubblico tramite codice

Decisione:
il tracking pubblico usa solo il `publicCode`. La route `/segnalazione` permette di controllare il codice; la route `/segnalazioni/[publicCode]` mostra la scheda pubblica solo se la segnalazione e approvata e ha uno stato pubblico.

Motivo:
mantiene il principio di nessun account cittadino e impedisce che segnalazioni pending o rifiutate diventino consultabili come pagine pubbliche.

Conseguenza:
le segnalazioni `pending_review` mostrano solo un messaggio di verifica in corso. Le segnalazioni `rejected` mostrano solo un messaggio generico di mancata pubblicazione. La timeline pubblica legge solo eventi `report_events.visibility = public` e non restituisce metadata, note interne o eventi interni.

### ADR-025 — Mappa pubblica filtrata e provider tile configurabile

Decisione:
la route `/mappa` mostra solo segnalazioni approvate con stato pubblico e coordinate, usando MapLibre GL JS. La query pubblica restituisce esclusivamente `publicCode`, titolo, categoria, coordinate, indirizzo opzionale, stato pubblico e data pubblicazione.

Motivo:
la mappa deve essere utile al cittadino senza esporre dati interni, note di moderazione, identificativi database o segnalazioni non pubbliche.

Conseguenza:
il provider tile resta sostituibile tramite `NEXT_PUBLIC_MAP_STYLE_URL`. In locale, se la variabile non e impostata, si usa lo style raster OpenStreetMap solo come fallback di sviluppo; la scelta del provider cartografico definitivo resta da deliberare prima della produzione.

### ADR-026 — Upload immagini con storage locale sostituibile

Decisione:
in VC-009 il cittadino puo allegare al massimo una foto opzionale alla segnalazione. L'immagine viene validata server-side, normalizzata a JPEG tramite `sharp`, ridimensionata a lato lungo massimo 2200 px e salvata tramite `StorageProvider`. In sviluppo il provider usa filesystem locale sotto `.local-storage/report-images`, ignorato da Git.

Motivo:
la foto aiuta la moderazione e la consultazione pubblica, ma non deve vincolare il core a un provider storage definitivo ne esporre path interni.

Conseguenza:
la produzione dello storage resta da definire. Le foto pending e rejected non sono servite dalla route pubblica; gli admin autenticati possono vederle nel backoffice. Le foto approvate sono servite tramite route applicativa che verifica sempre lo stato pubblico del report.

### ADR-027 — Rilevamento duplicati iniziale deterministico

Decisione:
in VC-010 il controllo duplicati avviene nel flusso `/segnala` prima della creazione definitiva. Usa solo criteri deterministici: stessa categoria, report approvato e pubblico, pubblicato negli ultimi 90 giorni, distanza massima 100 metri calcolata con formula Haversine. La query filtra nel database per categoria, stato pubblico, finestra temporale e bounding box; il calcolo preciso della distanza resta nel layer applicativo.

Motivo:
riduce duplicati evidenti senza introdurre AI, embedding, PostGIS o scoring opaco. Il payload mostrato al cittadino contiene solo dati gia pubblici: codice pubblico, titolo, categoria, indirizzo, stato pubblico, distanza stimata e data pubblicazione.

Conseguenza:
le soglie sono centralizzate in configurazione applicativa e potranno essere modificate. Pending e rejected non vengono mostrati. Se l'utente dichiara che il problema e diverso, puo continuare e creare una nuova segnalazione. La CTA di conferma persistente resta fuori scope e sara completata in VC-011.

### ADR-028 — Conferme anonime con cookie first-party

Decisione:
in VC-011 le conferme usano un cookie first-party anonimo `vc_report_confirmation_id`, HttpOnly, SameSite=Lax, path `/`, durata 180 giorni e Secure in produzione. Il cookie contiene un valore casuale non significativo. Il database salva solo una chiave `antiAbuseKey` derivata con SHA-256 dal valore cookie, mai il valore cookie in chiaro.

Motivo:
rispetta l'assenza di account cittadini, email, nome o telefono e limita il doppio click o conferme ripetute banali dallo stesso browser senza fingerprinting invasivo, CAPTCHA o raccolta di segnali device.

Conseguenza:
una conferma e consentita solo per report approvati e pubblici, verificando sempre lato server tramite `publicCode`. Il conteggio pubblico e aggregato. L'anti-abuso resta leggero: cancellare cookie, usare un altro browser o un altro dispositivo puo produrre una nuova conferma. Strategie piu forti restano fuori scope MVP e richiedono valutazione privacy.

### ADR-029 — Categorie gestibili dal backoffice senza hard delete

Decisione:
in VC-012 le categorie sono gestite dagli amministratori dal backoffice `/admin/categorie`. Ogni categoria ha nome, slug univoco e stato attivo/disattivato. Le nuove categorie nascono attive; gli admin possono modificarne nome, slug e stato, ma non cancellarle fisicamente.

Motivo:
le categorie devono poter evolvere senza deploy e senza interventi manuali sul database, mantenendo stabile lo storico delle segnalazioni gia create. I report usano `categoryId`, quindi il cambio slug non rompe le associazioni storiche.

Conseguenza:
solo categorie attive compaiono nel form `/segnala` e possono essere usate per nuove segnalazioni. Le categorie disattivate restano visibili nelle pagine admin e nei report pubblici storici. La tassonomia gerarchica, icone/colori, ordinamento manuale e destinatari restano fuori scope. Le categorie definitive restano una decisione da definire da parte di Visione Comune.

### ADR-030 — Matrice destinatari deterministica senza invio automatico

Decisione:
in VC-013 lo smistamento viene configurato con le tabelle `recipients` e `category_recipients`. Una categoria puo avere zero, uno o piu destinatari. Il destinatario principale e quello con `sortOrder = 0`; gli altri seguono l'ordine configurato.

Motivo:
prepara il flusso comunicazioni senza introdurre invio PEC/email, AI o routing automatico. La matrice resta amministrabile dal backoffice e deterministica: categoria → configurazione → destinatario suggerito.

Conseguenza:
il dettaglio admin di una segnalazione mostra solo un suggerimento in lettura. I destinatari disattivati restano nella configurazione ma vengono esclusi dalle proposte operative. Le associazioni non vengono eliminate quando una categoria viene disattivata. L'invio comunicazioni resta fuori scope fino a VC-015/VC-019.


### ADR-031 — Timeline pubblica e interna centralizzata

Decisione:
in VC-014 la timeline delle segnalazioni viene letta da `report_events` tramite use case dedicati. La vista pubblica usa solo eventi `visibility = public`; la vista admin usa eventi pubblici e interni.

Motivo:
la scheda pubblica deve mostrare lo storico rilevante senza esporre note, metadata operativi o dettagli tecnici. Il backoffice deve invece avere una cronologia completa e comprensibile per seguire moderazione e future comunicazioni.

Conseguenza:
la UI non traduce direttamente gli enum tecnici. Label, descrizioni e metadata ammessi sono centralizzati nel layer applicativo. `ReportCreated` resta interno, `ReportApproved` e pubblico, `ReportRejected` resta interno. Per VC-014 non viene introdotta una visibilita `system`; eventuali eventi tecnici restano interni finche non emerge un bisogno distinto.


### ADR-032 — Comunicazioni manuali senza invio automatico

Decisione:
in VC-015 gli admin possono registrare manualmente comunicazioni in uscita verso destinatari configurati, con canale `email` o `pec`, stato `draft`, `sent`, `delivered` o `failed`, e snapshot del destinatario al momento della registrazione.

Motivo:
preparare il workflow operativo senza integrare ancora provider PEC/email, preservando lo storico anche se la matrice destinatari cambia.

Conseguenza:
registrare una comunicazione come `sent` non cambia lo stato pubblico della segnalazione. Solo una comunicazione marcata manualmente `delivered` puo portare il report da `Segnalata` a `Comunicata`, passando da `Report.markCommunicated` e generando l'evento pubblico `ReportCommunicated`. Gli eventi tecnici `CommunicationRecorded`, `CommunicationSent`, `CommunicationDelivered` e `CommunicationFailed` restano interni.

### ADR-033 — Risoluzione verificata manualmente da Visione Comune

Decisione:
in VC-016 solo un admin autenticato puo marcare una segnalazione come `Risolta`, e solo quando lo stato pubblico corrente e `Comunicata`.

Motivo:
la risoluzione rappresenta una verifica operativa di Visione Comune, non una risposta automatica da PEC/email e non una dichiarazione del cittadino.

Conseguenza:
la transizione passa sempre dal dominio `Report.markResolved`, valorizza `resolvedAt` e registra un evento pubblico `ReportResolved`. L'admin puo aggiungere una nota interna opzionale salvata in `report_events.metadata.internalNote`: la timeline admin la mostra, la timeline pubblica non la espone. Per l'MVP `Risolta` e uno stato finale; riapertura e regressioni restano fuori scope.


### ADR-034 — Shell pubblica e admin separate

Decisione:
la navigazione pubblica e la navigazione admin sono shell separate. La shell pubblica viene applicata alle route pubbliche e nascosta sotto `/admin`; la shell admin viene applicata sotto `/admin` solo quando esiste una sessione admin attiva.

Motivo:
il prodotto deve essere navigabile senza mescolare UX pubblica e backoffice, e senza spostare le route gia implementate.

Conseguenza:
header, footer e menu mobile pubblici non compaiono nel backoffice. Il menu admin mostra utente autenticato, logout e link operativi, ma non sostituisce i controlli server-side gia presenti sulle pagine admin.

### ADR-035 — Notizie editoriali semplici

Decisione:
in VC-017 le notizie sono gestite con una tabella `news_posts`, stati `draft` e `published`, slug univoco URL-safe e immagine in evidenza opzionale.

Motivo:
la sezione deve permettere aggiornamenti pubblici utili senza trasformare l'MVP in un CMS complesso.

Conseguenza:
solo gli admin autenticati e attivi possono creare, modificare e pubblicare notizie. Il pubblico vede solo post `published` con `publishedAt` valorizzato. `publishedAt` rappresenta la prima pubblicazione e resta conservato se una notizia torna bozza. L'immagine in evidenza e un percorso locale opzionale sotto `public/` con testo alternativo obbligatorio quando presente; non introduce upload immagini news o storage esterno.

### ADR-036 — Rich text controllato per le notizie

Decisione:
in VC-017B il contenuto delle notizie viene scritto dagli admin con Tiptap e salvato come documento JSONB in `news_posts.content_json`. La vecchia colonna `content` resta come testo derivato e fallback legacy, ma non e piu la fonte primaria editoriale.

Motivo:
serve formattazione editoriale minima senza introdurre CMS esterni, Markdown ambiguo o HTML raw. Il JSON strutturato permette validazione server-side e rendering pubblico controllato.

Conseguenza:
sono consentiti solo paragrafi, H2, H3, grassetto, corsivo, link, elenchi puntati/numerati, blockquote, undo e redo. Non sono consentiti tabelle, media inline, embed, iframe, code block, HTML raw o plugin AI. I link vengono validati e il rendering pubblico usa componenti React basati sui nodi consentiti, senza `dangerouslySetInnerHTML`. I contenuti testuali gia presenti vengono convertiti dalla migration in paragrafi Tiptap validi.

## DA DEFINIRE

### D-003 — Storage immagini produzione

Da decidere:
filesystem su VPS, S3-compatible esterno, MinIO o altra soluzione.

### D-004 — Provider geocoding

Da decidere:
provider per geocoding e reverse geocoding, incluse quote, costi e licenze.

### D-005 — Provider PEC

Da decidere:
provider e modalita di integrazione PEC: manuale, SMTP/IMAP, API o approccio ibrido.

### D-006 — Provider newsletter/email

Da decidere:
provider newsletter/email o gestione manuale iniziale.

### D-007 — Provider AI

Da decidere:
provider AI e funzioni abilitate, nel rispetto dell'AI solo assistiva.

### D-008 — Anti-abuso conferme

Parzialmente deciso per MVP:
cookie first-party anonimo e vincolo database su report + chiave derivata, come definito in ADR-028.

Da decidere prima di eventuale scala maggiore:
se servono limiti aggiuntivi anti-abuso, rate limit, monitoraggio operativo o altri controlli compatibili con minimizzazione dati e privacy.

### D-009 — Retention, log e privacy

Da decidere:
policy di retention, gestione log tecnici, privacy, cookie e richieste di rimozione/rettifica.

### D-010 — Limiti upload immagini

Parzialmente deciso per MVP:
JPEG, PNG e WebP in input fino a 10 MB, normalizzati a JPEG con lato lungo massimo 2200 px.

Da decidere prima della produzione:
limiti definitivi, scansione antivirus, policy di retention, backup e trattamento privacy operativo.

### D-011 — Categorie definitive

Da decidere:
categorie MVP e criteri di modifica nel backoffice.

### D-012 — Matrice enti e destinatari

Da decidere:
associazione tra categorie, enti, uffici, priorita e destinatari.

### D-013 — Provider tile mappa produzione

Da decidere:
provider/style cartografico definitivo per produzione, incluse licenze, costi, limiti di traffico, attribution e disponibilita.
