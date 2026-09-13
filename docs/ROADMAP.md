# Roadmap

Stato: proposta operativa da approvare prima dell'implementazione.

Le task sono organizzate come vertical slice piccole e verificabili. L'obiettivo e arrivare rapidamente a un primo flusso funzionante: creazione segnalazione, moderazione, pubblicazione e consultazione pubblica. PEC, AI e newsletter sono isolate e rimandabili.

## VC-001 — Bootstrap progetto

1. Titolo: Bootstrap Next.js
2. Obiettivo: inizializzare il progetto Next.js con App Router, TypeScript, lint, test runner e struttura minima.
3. Scope: setup Node.js standard, script npm, TypeScript, struttura `src`, configurazione base Vitest e Playwright, validazione env iniziale.
4. Fuori scope: pagine applicative complete, database reale, migration, Docker, auth, UI definitiva.
5. Dipendenze: approvazione roadmap e package manager.
6. Business rule coinvolte: nessuna business rule applicativa, solo predisposizione.
7. User flow coinvolti: nessuno.
8. Acceptance criteria: progetto avviabile in locale; typecheck/lint/test base eseguibili; nessuna configurazione Docker introdotta.
9. Test richiesti: smoke test Vitest; verifica script `typecheck`, `lint`, `test`.
10. Rischi: scelta package manager non deliberata; differenze versione Node.js locale/VPS.
11. Risultato verificabile: schermata placeholder tecnica e test base verdi.

## VC-002 — Fondazione dominio segnalazioni

1. Titolo: Modello dominio report
2. Obiettivo: definire tipi, stati, transizioni e regole base per una segnalazione.
3. Scope: `Report`, `publicStatus`, `moderationStatus`, generazione codice pubblico, eventi dominio minimi, regole visibilita.
4. Fuori scope: persistenza database, UI, upload immagini, mappa.
5. Dipendenze: VC-001.
6. Business rule coinvolte: BR-003, BR-004, BR-005, BR-006, BR-017, BR-018.
7. User flow coinvolti: FLOW-001, FLOW-002, FLOW-006.
8. Acceptance criteria: una segnalazione nuova nasce non pubblica; il codice pubblico e univoco nel dominio; gli stati pubblici ammessi sono solo quelli approvati.
9. Test richiesti: unit test su generazione codice, stati ammessi, visibilita e transizioni vietate.
10. Rischi: confondere stato pubblico e stato interno di moderazione.
11. Risultato verificabile: suite di dominio verde senza database.

## VC-003 — Fondazione database

1. Titolo: Schema PostgreSQL iniziale
2. Obiettivo: introdurre Drizzle e schema database per report, eventi, categorie e allegati minimi.
3. Scope: configurazione Drizzle, schema iniziale, migration versionata, repository base per report.
4. Fuori scope: dati seed definitivi, categorie definitive, comunicazioni, PEC, newsletter.
5. Dipendenze: VC-001, VC-002, decisione minima su come eseguire PostgreSQL in locale o servizio gestito.
6. Business rule coinvolte: BR-003, BR-004, BR-017, BR-018.
7. User flow coinvolti: FLOW-001, FLOW-002.
8. Acceptance criteria: migration applicabile su database pulito; repository crea e legge una segnalazione non pubblica.
9. Test richiesti: integration test repository con PostgreSQL di test; test vincolo unicita codice pubblico.
10. Rischi: ambiente DB locale non definito; migration premature troppo dettagliate.
11. Risultato verificabile: database iniziale creato tramite migration e test repository verdi.

## VC-004 — Creazione segnalazione senza account

1. Titolo: Invio segnalazione
2. Obiettivo: permettere a un cittadino non autenticato di creare una segnalazione non pubblica.
3. Scope: form minimo, validazione server-side, categoria temporanea o selezione da categorie seed, posizione, descrizione, creazione report, codice mostrato all'utente.
4. Fuori scope: upload immagini, duplicati, mappa, auth admin, PEC.
5. Dipendenze: VC-003, categorie MVP provvisorie o seed tecnico approvato.
6. Business rule coinvolte: BR-001, BR-002, BR-003, BR-004, BR-013, BR-014, BR-016.
7. User flow coinvolti: FLOW-001.
8. Acceptance criteria: l'utente invia senza account e senza dati personali obbligatori; riceve codice pubblico; la segnalazione entra in `Da verificare`; non compare pubblicamente.
9. Test richiesti: unit test validazione; integration test creazione; e2e invio form e visualizzazione codice.
10. Rischi: duplicati richiesti dal flow ma non ancora implementati; va esplicitato un placeholder non bloccante finche VC-010 non e pronta.
11. Risultato verificabile: prima segnalazione creabile end-to-end e privata.

## VC-005 — Auth admin

1. Titolo: Accesso backoffice
2. Obiettivo: proteggere l'area amministrativa con Auth.js.
3. Scope: login admin, sessione, allowlist o provider configurabile, guardia route admin.
4. Fuori scope: ruoli avanzati, gestione utenti admin da UI, audit accessi completo.
5. Dipendenze: VC-001, decisione minima su provider Auth.js.
6. Business rule coinvolte: BR-005.
7. User flow coinvolti: FLOW-002, FLOW-004, FLOW-005.
8. Acceptance criteria: solo admin autenticati accedono al backoffice; utenti pubblici non vedono dati non moderati.
9. Test richiesti: integration test guardia admin; e2e accesso negato e accesso consentito.
10. Rischi: provider email/OAuth non deciso; possibile bisogno di login bootstrap temporaneo.
11. Risultato verificabile: backoffice protetto.

## VC-006 — Moderazione admin

1. Titolo: Verifica segnalazioni
2. Obiettivo: consentire a un admin di vedere segnalazioni da verificare e approvarle o rifiutarle.
3. Scope: lista admin, dettaglio admin, approvazione, rifiuto, correzione categoria se disponibile, evento timeline interno/pubblico coerente.
4. Fuori scope: modifica completa contenuti, PEC, duplicati avanzati, ruoli multipli.
5. Dipendenze: VC-003, VC-005.
6. Business rule coinvolte: BR-004, BR-005, BR-006, BR-017, BR-018.
7. User flow coinvolti: FLOW-002.
8. Acceptance criteria: approvando una segnalazione diventa pubblica con stato `Segnalata`; rifiutandola resta non pubblica.
9. Test richiesti: T-005, T-006, integration test transizione, e2e moderazione.
10. Rischi: dati personali nel testo e foto non ancora gestiti pienamente.
11. Risultato verificabile: flusso create -> approve funzionante.

## VC-007 — Dettaglio pubblico e tracking codice

1. Titolo: Consultazione segnalazione
2. Obiettivo: mostrare una segnalazione approvata e permettere tracking tramite codice.
3. Scope: pagina dettaglio pubblico, ricerca codice, stato pubblico, timeline pubblica.
4. Fuori scope: mappa, conferme, PEC, newsletter.
5. Dipendenze: VC-006.
6. Business rule coinvolte: BR-003, BR-006, BR-017, BR-018.
7. User flow coinvolti: FLOW-006.
8. Acceptance criteria: codice valido recupera la segnalazione; segnalazioni non approvate non espongono dati pubblici; timeline mostra solo eventi pubblici.
9. Test richiesti: e2e tracking codice; integration test visibilita; test codice non trovato.
10. Rischi: esposizione involontaria di note o eventi interni.
11. Risultato verificabile: cittadino puo seguire una segnalazione approvata dal codice.

## VC-008 — Mappa segnalazioni

1. Titolo: Mappa pubblica
2. Obiettivo: visualizzare su mappa le segnalazioni approvate.
3. Scope: MapLibre GL JS, marker o clustering iniziale, query pubblica filtrata, link al dettaglio.
4. Fuori scope: geocoding automatico, filtri avanzati, statistiche.
5. Dipendenze: VC-006, scelta provider tile minima.
6. Business rule coinvolte: BR-006, BR-017.
7. User flow coinvolti: MVP pubblico, FLOW-002.
8. Acceptance criteria: solo segnalazioni approvate appaiono su mappa; marker cliccabile porta al dettaglio.
9. Test richiesti: integration test endpoint/query mappa; e2e mappa con marker; test esclusione non approvate.
10. Rischi: provider tile/geocoding non deciso; resa mobile; mappa caotica.
11. Risultato verificabile: mappa pubblica utile con almeno una segnalazione approvata.

## VC-009 — Upload immagini moderabile

1. Titolo: Allegati immagine
2. Obiettivo: consentire upload immagine sulla nuova segnalazione mantenendo moderazione prima della pubblicazione.
3. Scope: adapter storage locale, metadati allegato, validazione formato/dimensione provvisoria, visualizzazione admin e pubblica dopo approvazione.
4. Fuori scope: storage produzione definitivo, CDN, scansione antivirus avanzata.
5. Dipendenze: VC-004, VC-006, decisione minima su limiti upload provvisori.
6. Business rule coinvolte: BR-004, BR-005, BR-011, BR-017.
7. User flow coinvolti: FLOW-001, FLOW-002.
8. Acceptance criteria: immagine caricata non appare pubblicamente prima dell'approvazione; admin puo visualizzarla; formati non validi sono rifiutati.
9. Test richiesti: integration test upload valido/non valido; e2e invio con immagine; test privacy visibilita.
10. Rischi: limiti upload non deliberati; contenuti offensivi o dati personali in foto.
11. Risultato verificabile: segnalazione con immagine approvabile e pubblicabile.

## VC-010 — Rilevamento duplicati iniziale

1. Titolo: Duplicati prima della creazione
2. Obiettivo: mostrare possibili segnalazioni simili prima dell'invio definitivo.
3. Scope: ricerca per categoria, distanza geografica e testo semplice; UI per confermare esistente o continuare se problema diverso.
4. Fuori scope: AI deduplica, scoring complesso, blocco assoluto.
5. Dipendenze: VC-004, VC-007, VC-008.
6. Business rule coinvolte: BR-013, BR-014.
7. User flow coinvolti: FLOW-001.
8. Acceptance criteria: possibili duplicati vengono mostrati; l'utente puo confermare esistente o continuare dichiarando problema diverso.
9. Test richiesti: T-003, T-004, EC-002, EC-003; e2e duplicato e proseguimento.
10. Rischi: falsi positivi, falsi negativi, duplicati non pubblici da non esporre.
11. Risultato verificabile: controllo duplicati attivo senza blocco assoluto.

## VC-011 — Conferme segnalazione

1. Titolo: Conferma anche tu
2. Obiettivo: permettere a un cittadino di confermare una segnalazione pubblica.
3. Scope: pulsante conferma, conteggio pubblico, registrazione conferma, protezione minima anti-ripetizione.
4. Fuori scope: strategia anti-abuso definitiva, account cittadini, commenti, upload foto aggiuntive.
5. Dipendenze: VC-007, decisione minima su anti-abuso provvisorio.
6. Business rule coinvolte: BR-010, BR-011, BR-012.
7. User flow coinvolti: FLOW-003.
8. Acceptance criteria: una conferma aumenta il conteggio; non sono disponibili commenti o foto aggiuntive; ripetizioni banali sono limitate.
9. Test richiesti: T-010, unit/integration anti-ripetizione, e2e conferma.
10. Rischi: anti-abuso incompleto senza account; privacy fingerprint.
11. Risultato verificabile: conferme pubbliche funzionanti e tracciate.

## VC-012 — Categorie gestibili

1. Titolo: Gestione categorie
2. Obiettivo: consentire agli admin di gestire categorie attive senza deploy.
3. Scope: CRUD essenziale categorie, slug, attivazione/disattivazione, uso nel form e in moderazione.
4. Fuori scope: tassonomie complesse, permessi granulari.
5. Dipendenze: VC-005, VC-006.
6. Business rule coinvolte: BR-013, EC-009.
7. User flow coinvolti: FLOW-001, FLOW-002.
8. Acceptance criteria: categorie attive compaiono nei form; categorie disattivate non sono selezionabili per nuove segnalazioni; storico report non si rompe.
9. Test richiesti: integration test categorie; e2e creazione/modifica/disattivazione.
10. Rischi: categorie definitive non ancora approvate.
11. Risultato verificabile: categorie modificabili dal backoffice.

## VC-013 — Destinatari e matrice smistamento

1. Titolo: Destinatari enti
2. Obiettivo: gestire destinatari e associazione categoria-destinatario.
3. Scope: CRUD destinatari, PEC/email, associazione a categorie, priorita.
4. Fuori scope: invio automatico PEC/email, template avanzati.
5. Dipendenze: VC-012, matrice enti iniziale.
6. Business rule coinvolte: BR-019, EC-012.
7. User flow coinvolti: FLOW-004.
8. Acceptance criteria: admin puo associare una categoria a uno o piu destinatari; una segnalazione approvata puo mostrare destinatari suggeriti.
9. Test richiesti: integration test associazioni; e2e gestione destinatario.
10. Rischi: matrice enti non definitiva; destinatario non noto.
11. Risultato verificabile: smistamento suggerito senza invio automatico.

## VC-014 — Timeline completa

1. Titolo: Eventi pubblici e interni
2. Obiettivo: consolidare la timeline distinguendo eventi pubblici, interni e tecnici.
3. Scope: `ReportEvent`, visibilita evento, rendering pubblico/admin, eventi per creazione, approvazione, comunicazione, risoluzione.
4. Fuori scope: notifiche, newsletter, import PEC.
5. Dipendenze: VC-006, VC-007.
6. Business rule coinvolte: BR-018.
7. User flow coinvolti: FLOW-002, FLOW-004, FLOW-005, FLOW-006.
8. Acceptance criteria: pubblico vede solo storico rilevante; admin vede eventi operativi; note interne non sono pubbliche.
9. Test richiesti: unit test visibilita eventi; integration test timeline; e2e dettaglio pubblico/admin.
10. Rischi: esposizione dati interni.
11. Risultato verificabile: timeline coerente su dettaglio pubblico e admin.

## VC-015 — Comunicazioni manuali

1. Titolo: Comunicazione registrata
2. Obiettivo: permettere all'admin di registrare una comunicazione all'ente e aggiornare lo stato solo su consegna confermata.
3. Scope: modello `OutboundCommunication`, stato comunicazione, canale manuale, destinatario, data invio/consegna, cambio stato a `Comunicata`.
4. Fuori scope: invio PEC automatico, lettura ricevute, allegati inbound.
5. Dipendenze: VC-013, VC-014.
6. Business rule coinvolte: BR-006, BR-007, BR-008, BR-019.
7. User flow coinvolti: FLOW-004.
8. Acceptance criteria: PEC/email non consegnata non cambia stato; consegna confermata porta a `Comunicata`; timeline aggiornata.
9. Test richiesti: T-007, T-008, EC-005, EC-006; integration test transizione.
10. Rischi: errore umano nella registrazione; comunicazioni multiple.
11. Risultato verificabile: stato `Comunicata` gestibile senza integrazione PEC automatica.

## VC-016 — Risoluzione segnalazione

1. Titolo: Chiusura verificata
2. Obiettivo: consentire all'admin di segnare una segnalazione come risolta dopo verifica Visione Comune.
3. Scope: azione admin `Risolta`, evento timeline, data risoluzione.
4. Fuori scope: riapertura automatica, workflow ricomparsa problema.
5. Dipendenze: VC-014.
6. Business rule coinvolte: BR-006, BR-009, EC-014.
7. User flow coinvolti: FLOW-005.
8. Acceptance criteria: solo admin puo impostare `Risolta`; la timeline registra l'evento; il pubblico vede stato aggiornato.
9. Test richiesti: T-009, integration test transizione, e2e risoluzione.
10. Rischi: regola riapertura ancora aperta.
11. Risultato verificabile: ciclo `Segnalata -> Comunicata -> Risolta` completabile.

## VC-017 — Notizie e aggiornamenti

1. Titolo: Aggiornamenti pubblici
2. Obiettivo: pubblicare notizie o aggiornamenti editoriali separati dalle segnalazioni.
3. Scope: modello contenuto semplice, lista pubblica, dettaglio, bozza/pubblicato.
4. Fuori scope: newsletter provider, CMS esterno, commenti.
5. Dipendenze: VC-005.
6. Business rule coinvolte: nessuna specifica sulle segnalazioni.
7. User flow coinvolti: MVP pubblico.
8. Acceptance criteria: admin crea un aggiornamento; pubblico vede solo contenuti pubblicati.
9. Test richiesti: integration test pubblicazione; e2e creazione e visualizzazione.
10. Rischi: tono editoriale e workflow redazionale non definiti.
11. Risultato verificabile: sezione notizie minima funzionante.

## VC-018 — Newsletter adapter

1. Titolo: Iscrizione newsletter
2. Obiettivo: predisporre iscrizione newsletter senza vincolare il core a un provider.
3. Scope: `NewsletterProvider`, form iscrizione, consenso, implementazione manuale/null o provider scelto.
4. Fuori scope: automazioni campagne, segmentazione avanzata.
5. Dipendenze: provider newsletter/email o scelta di modalita manuale.
6. Business rule coinvolte: nessuna business rule report, ma privacy/consenso da definire.
7. User flow coinvolti: MVP pubblico.
8. Acceptance criteria: iscrizione validata; fallimento provider gestito; nessun accoppiamento diretto al vendor.
9. Test richiesti: unit test adapter; integration test iscrizione; e2e form.
10. Rischi: compliance, deliverability, provider non deciso.
11. Risultato verificabile: iscrizione newsletter funzionante o registrata in modalita manuale.

## VC-019 — PEC adapter

1. Titolo: Integrazione PEC
2. Obiettivo: introdurre invio/ricezione PEC tramite adapter quando il provider sara scelto.
3. Scope: `PecProvider`, invio comunicazione, salvataggio external id, ricevuta consegna, allegati inbound.
4. Fuori scope: decisioni automatiche senza admin, cambio stati non auditato.
5. Dipendenze: VC-015, provider PEC.
6. Business rule coinvolte: BR-007, BR-008, BR-015, BR-019.
7. User flow coinvolti: FLOW-004.
8. Acceptance criteria: consegna PEC aggiorna stato a `Comunicata`; mancata consegna non cambia stato; ricevute sono auditabili.
9. Test richiesti: integration test adapter mocked; test consegna/mancata consegna; e2e flusso admin.
10. Rischi: formati ricevute, riconciliazione inbound, sicurezza credenziali.
11. Risultato verificabile: comunicazione PEC integrata senza cambiare dominio.

## VC-020 — AI assistiva

1. Titolo: Suggerimenti AI
2. Obiettivo: introdurre suggerimenti AI non vincolanti per admin.
3. Scope: `AiProvider`, suggerimento categoria/destinatario/dati personali/duplicati, revisione manuale.
4. Fuori scope: decisioni autonome, invii automatici, moderazione automatica.
5. Dipendenze: provider AI, VC-006, VC-010, VC-013.
6. Business rule coinvolte: BR-015.
7. User flow coinvolti: FLOW-002, FLOW-004.
8. Acceptance criteria: ogni suggerimento resta modificabile o ignorabile dall'admin; nessuna transizione irreversibile e automatica.
9. Test richiesti: unit test fallback e output invalido; integration test provider mocked.
10. Rischi: privacy, costi, allucinazioni, fiducia eccessiva.
11. Risultato verificabile: suggerimenti visibili nel backoffice senza decisioni automatiche.

## VC-021 — Metriche operative

1. Titolo: Metriche MVP
2. Obiettivo: fornire conteggi operativi base per admin e, se utile, pubblico.
3. Scope: conteggi per stato, categoria, periodo, conferme.
4. Fuori scope: dashboard avanzate, reportistica complessa, analytics terzi.
5. Dipendenze: VC-006, VC-011, VC-016.
6. Business rule coinvolte: BR-020.
7. User flow coinvolti: backoffice admin.
8. Acceptance criteria: admin vede numeri coerenti e filtrabili; query non espongono dati non pubblici.
9. Test richiesti: integration test aggregazioni; e2e vista metriche.
10. Rischi: definizioni metriche non deliberate; performance su grandi volumi futuri.
11. Risultato verificabile: pannello metriche base.

## Ordine consigliato

1. VC-001
2. VC-002
3. VC-003
4. VC-004
5. VC-005
6. VC-006
7. VC-007
8. VC-008
9. VC-009
10. VC-010
11. VC-011
12. VC-012
13. VC-013
14. VC-014
15. VC-015
16. VC-016
17. VC-017
18. VC-018
19. VC-019
20. VC-020
21. VC-021

La prima vertical slice realmente utile si chiude con VC-006: un cittadino crea una segnalazione, un admin la modera, e il sistema puo dimostrare che nulla diventa pubblico senza approvazione. La prima esperienza pubblica completa arriva con VC-007 e VC-008.

