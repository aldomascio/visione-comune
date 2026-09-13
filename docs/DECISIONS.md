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

Da decidere:
strategia anti-abuso compatibile con assenza di account cittadini e minimizzazione dati.

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
