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

Da decidere:
formati accettati, dimensione massima, compressione, scansione, moderazione e retention.

### D-011 — Categorie definitive

Da decidere:
categorie MVP e criteri di modifica nel backoffice.

### D-012 — Matrice enti e destinatari

Da decidere:
associazione tra categorie, enti, uffici, priorita e destinatari.
