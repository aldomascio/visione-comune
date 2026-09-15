# MVP Consolidation Spec

Stato: proposta tecnica; P0-01/P0-01B implementate per copy conferme, fonte report, creazione manuale admin e audit admin creator.

Questa specifica confronta l'MVP implementato con le esigenze emerse dalla review pre-UI/UX. Non approva nuove business rule e non sostituisce le decisioni esistenti. Le modifiche indicate come P0/P1/P2 devono essere trasformate in task successive prima di implementare codice o migration.

## 1. Executive summary

Il core MVP di Visione Comune e solido: creazione segnalazione anonima, moderazione, pubblicazione, tracking, mappa, conferme, categorie, destinatari, smistamento, timeline, comunicazioni manuali, risoluzione, immagini, notizie e metriche operative sono gia implementati.

I gap principali non riguardano gli stati pubblici, che devono restare `Segnalata`, `Comunicata`, `Risolta`, ma il workflow operativo interno e alcuni modelli dati che conviene stabilizzare prima del redesign UI/UX:

- distinguere meglio stato pubblico, moderazione e fase operativa interna senza esporre complessita al cittadino;
- fonte della segnalazione e inserimento manuale dal backoffice: implementati in P0-01; audit `createdByAdminId` implementato in P0-01B;
- gestire duplicati post-submit senza cancellare record;
- preparare gli allegati a tipi diversi, review privacy e foto di risoluzione;
- far evolvere `OutboundCommunication` in una futura `Transmission` capace di collegare una o piu segnalazioni allo stesso destinatario;
- correggere il copy pubblico delle conferme per non suggerire identita/persona verificata;
- definire hardening anti-abuso e privacy immagini prima del go-live.

La proposta meno invasiva e introdurre poche estensioni strutturali prima del redesign: `reports.source` e gia stato completato in P0-01; restano modello duplicati, modello attachment piu espressivo e relazione `transmission_reports` o equivalente. Il registro interno puo continuare a basarsi su `report_events`, ampliandone tipi e metadata, senza introdurre subito un motore workflow complesso.

## 2. Stato attuale

### Report e stati

Il dominio `Report` contiene:

- id interno;
- codice pubblico `VC-XXXXXXXX`;
- titolo, descrizione, categoria;
- fonte operativa `platform`, `social`, `email`, `direct` o `other`;
- audit opzionale `createdByAdminId` per report creati manualmente da admin;
- posizione con latitudine, longitudine e indirizzo opzionale;
- `moderationStatus`: `pending_review`, `approved`, `rejected`;
- `publicStatus`: `reported`, `communicated`, `resolved`;
- date: `createdAt`, `publishedAt`, `communicatedAt`, `resolvedAt`.

Le transizioni principali sono nel dominio:

- nuova segnalazione: `pending_review`, non pubblica;
- approvazione: `approved` + `reported`;
- comunicazione: solo da `reported` a `communicated`;
- risoluzione: solo da `communicated` a `resolved`;
- rifiuto: solo prima dell'approvazione.

### Database

Lo schema PostgreSQL/Drizzle include:

- `reports`;
- `categories`;
- `recipients`;
- `category_recipients`;
- `report_events`;
- `report_attachments`;
- `report_confirmations`;
- `outbound_communications`;
- `news_posts`;
- `admin_users`.

I vincoli DB proteggono unicita codice pubblico, coerenza stato pubblico/moderazione, coordinate, timestamp principali e vincoli su comunicazioni.

### Timeline e registro

`report_events` traccia eventi pubblici e interni. La timeline pubblica filtra solo eventi con visibilita `public` e descrizione pubblica. La timeline admin mostra eventi interni e metadata selezionati.

Eventi attuali:

- `ReportCreated`;
- `ReportApproved`;
- `ReportRejected`;
- `ReportCommunicated`;
- `ReportResolved`;
- `CommunicationRecorded`;
- `CommunicationSent`;
- `CommunicationDelivered`;
- `CommunicationFailed`.

### Comunicazioni

`OutboundCommunication` rappresenta una comunicazione manuale verso un destinatario per una singola segnalazione. Ha canale `email` o `pec`, stato `draft`, `sent`, `delivered`, `failed`, snapshot destinatario, oggetto, corpo, date e `externalMessageId` opzionale.

La consegna confermata porta la segnalazione da `Segnalata` a `Comunicata`, rispettando BR-007: `Comunicata` significa comunicazione consegnata.

### Conferme

Le conferme sono persistite in `report_confirmations` con `reportId`, `antiAbuseKey` e `createdAt`. L'identificatore e derivato da cookie first-party anonimo hashato lato server. Esiste vincolo unique per report + anti-abuse key.

P0-01: il copy pubblico usa formule neutre come `Nessuna conferma ricevuta`, `1 conferma ricevuta` e `N conferme ricevute`, evitando conteggi di persone identificate.

### Duplicati

Il sistema rileva possibili duplicati prima dell'invio tramite categoria, distanza geografica e finestra temporale. Il duplicato pre-submit non blocca se l'utente dichiara problema diverso.

P0-02 ha introdotto il modello per marcare duplicati dopo la creazione da backoffice.

### Immagini

Il sistema accetta una foto opzionale per segnalazione, valida MIME reale JPEG/PNG/WebP, limite 10 MB, normalizza a JPEG con `sharp`, ridimensiona e non serve foto non pubbliche. Lo schema attuale consente una sola riga attachment per report e `type = image`.

Mancano:

- tipi distinti per foto originale e foto risoluzione;
- stato review privacy dell'allegato;
- controllo automatico volti/targhe;
- piu allegati per report.

### Metriche

Sono presenti metriche operative admin e metriche pubbliche aggregate su ricevute, pubblicate, comunicate, risolte, rifiutate, conferme, tempi mediani e trend.

Le metriche operative distinguono i duplicati per i conteggi principali pubblicati/comunicati/risolti; restano aperte metriche piu avanzate su trasmissioni aggregate e solleciti.

## 3. Gap analysis

| Area | Esistente | Gap | Modifica proposta | Priorita | Migration | Impatto UX |
| --- | --- | --- | --- | --- | --- | --- |
| Stati pubblici | `reported`, `communicated`, `resolved` coerenti con BR-006 | Nessun gap sugli stati pubblici | Mantenerli invariati e non usarli per workflow interno dettagliato | P0 come vincolo | No | Tutte le UI pubbliche restano semplici |
| Workflow operativo interno | Moderazione + eventi + comunicazioni | Manca fase operativa tipo da trasmettere/in attesa/riscontro/verifica | Usare stato derivato da report, eventi e comunicazioni; aggiungere enum operativo solo se serve filtro persistente | P0 | Possibile, non obbligatoria subito | `/admin`, `/admin/segnalazioni`, dettaglio admin |
| Registro interno | `report_events` con visibilita e metadata | Mancano eventi per note, cambi categoria, duplicati, risposte, solleciti, verifiche, privacy image review | Estendere `report_event_type` e metadata; non creare subito event sourcing | P0/P1 | Si, enum event types | Timeline admin |
| Intake manuale | `/segnala` pubblico + `/admin/segnalazioni/nuova` | P0-01 implementata; resta da usare la fonte in metriche/filtri futuri | `reports.source` e `CreateAdminReportUseCase` aggiunti | P0 completata | Si | Pagina dedicata nel backoffice |
| Duplicati post-submit | Rilevamento pre-submit + `reports.duplicate_of_report_id` | Implementato P0-02; restano possibili affinamenti metriche/filtri | Relazione duplicati tracciata da eventi interni | P0 completato | Si | Dettaglio admin, tracking, dettaglio pubblico, mappa |
| Conferme | Cookie anonimo + unique DB + conteggio | P0-01 copy risolto; anti-abuso resta minimo | Prevedere rate limit e hardening se emerge abuso | P1 hardening | Possibile | `/segnalazioni/[publicCode]`, duplicati |
| Immagini | Una foto report, moderata con report | Nessun tipo/stato privacy; nessuna foto risoluzione | Estendere attachment con `type`, `reviewStatus`, vincoli meno rigidi | P0 per modello; P1 detector | Si | `/segnala`, dettaglio admin, dettaglio pubblico |
| Privacy immagini | EXIF rimossi, resize, conversione | Nessun controllo volti/targhe | Inserire detector dopo upload/processamento e prima pubblicazione | P1 | Probabile | Moderazione admin, foto report |
| Foto risoluzione | Non supportata | Serve foto dopo intervento admin | Riutilizzare attachment/storage con `resolution_photo` | P0 se la UI finale deve mostrarla | Si | Risoluzione admin, scheda pubblica |
| Comunicazioni | `OutboundCommunication` 1:1 report | Futuro PEC non deve essere 1 report = 1 PEC | Evolvere a `Transmission` con relazione N:M report | P0 | Si | Comunicazioni admin, futuro `/admin/trasmissioni` |
| Trasmissioni aggregate | Non supportate | Invio multi-report richiederebbe riscrittura | Introdurre tabella relazione `transmission_reports` anche se UI iniziale resta 1 report | P0 | Si | Futuro backoffice trasmissioni |
| Solleciti | Non presenti | Nessuna rappresentazione | Per ora evento/azione suggerita; tabella dedicata solo se automazioni | P2 | No ora | Futuro admin |
| Anti-abuso pubblico | Validazioni, moderation, cookie conferme, MIME reale immagini | Nessun rate limit centrale; geocoding proxy esposto; newsletter futura non coperta | Strategia rate limit e abuse logging pre-go-live | P1 | Possibile | Endpoint pubblici, messaggi errore |
| Metriche | Operative base | Non distinguono fonte/duplicati/transmission | Aggiornare dopo modello source/duplicati/transmission | P1/P2 | Dipende | `/admin`, Home pubblica se esposta |

## 4. Workflow pubblico target

Il workflow pubblico deve restare invariato nella sostanza:

1. Il cittadino crea una segnalazione senza account.
2. Il sistema controlla possibili duplicati prima della creazione.
3. Se l'utente prosegue, riceve un codice pubblico.
4. La segnalazione resta non pubblica finche non viene approvata.
5. Se approvata, diventa `Segnalata` e puo apparire in scheda pubblica e mappa.
6. Quando una trasmissione risulta consegnata all'ente, diventa `Comunicata`.
7. Quando Visione Comune verifica la risoluzione, diventa `Risolta`.
8. Le conferme restano anonime e aggregate.
9. I duplicati post-submit, se pubblici, devono essere gestiti senza cancellare codice originale o storico.

Il pubblico non deve vedere:

- workflow operativo interno granulare;
- note interne;
- ricevute tecniche PEC;
- antiAbuseKey/cookie;
- metadata tecnici;
- dati privacy rilevati nelle immagini.

## 5. Workflow operativo interno proposto

Gli stati pubblici non vanno estesi. Il workflow operativo puo essere modellato in modo derivato:

| Fase operativa | Come derivarla inizialmente | Serve enum persistito? |
| --- | --- | --- |
| Da verificare | `moderationStatus = pending_review` | No |
| Approvata | `moderationStatus = approved`, `publicStatus = reported`, nessuna transmission consegnata | No |
| Da trasmettere | Report approvato e nessuna transmission sent/delivered verso destinatario previsto | Derivato, salvo esigenze filtro performance |
| Trasmessa/consegnata | transmission/communication `delivered`, report `communicated` | No, report pubblico basta |
| In attesa di riscontro | report `communicated`, nessuna risposta/risoluzione | Derivato |
| Riscontro ricevuto | evento inbound reply collegato | No, evento |
| Da verificare sul territorio | evento/nota interna o future action dopo riscontro | Probabile evento/future task, non enum ora |
| Chiusa | report `resolved` | No |
| Respinta | `moderationStatus = rejected` | No |
| Duplicata | relazione duplicato attiva | Derivato da relazione |

### Enum operativo vs derived state vs eventi

#### Enum operativo

Pro:

- filtri admin semplici;
- query immediate;
- utile se la dashboard deve mostrare code operative precise.

Contro:

- rischio di duplicare e contraddire public status, moderation status e communication status;
- richiede molte regole di sincronizzazione;
- puo far sembrare pubblici stati che devono restare interni.

#### Derived state

Pro:

- meno duplicazione;
- coerente con architettura attuale;
- riduce migration premature;
- business rule centrali restano nei use case.

Contro:

- query piu complesse;
- se gli operatori vogliono code operative manuali, alcuni casi non sono derivabili.

#### Workflow/eventi

Pro:

- ottimo per registro interno e audit;
- consente note, risposte, solleciti, verifiche senza cambiare stato pubblico;
- gia vicino a `report_events`.

Contro:

- non basta da solo per query/filtro se non si introduce proiezione o derived state;
- metadata JSON richiede disciplina.

#### Raccomandazione

Usare una combinazione:

- `moderationStatus` e `publicStatus` restano persistiti;
- `Transmission.status` resta persistito per comunicazioni;
- duplicati e attachment review hanno stato/relazione dedicata;
- le fasi operative generali vengono derivate;
- `report_events` registra il registro interno;
- valutare una `operationalStatus` persistita solo dopo aver definito schermate operative che non possono essere derivate.

## 6. Modello Report aggiornato

Estensione proposta minima:

```text
reports
- source: enum/text not null default 'platform'
- duplicate_of_report_id: nullable FK reports.id oppure relazione dedicata
- created_by_admin_id: nullable FK admin_users.id, opzionale se source != platform
```

### `source`

Fonti iniziali:

- `platform`: form pubblico;
- `social`: ricevuta da social;
- `email`: ricevuta via email/PEC non automatizzata;
- `direct`: raccolta diretta/territorio;
- `other`: altro.

Raccomandazione: enum DB `report_source` o varchar con check. Per un set piccolo e stabile, enum e coerente con gli stati esistenti. Se si prevede forte variabilita, varchar + check applicativo e piu flessibile.

Default/backfill: tutti i report esistenti diventano `platform`.

Impatto:

- `CreateReportUseCase` resta per fonte `platform`;
- aggiungere `CreateAdminReportUseCase` per fonti non-platform;
- publicCode resta obbligatorio e invariato;
- moderazione puo essere identica: anche una segnalazione manuale puo partire `pending_review` oppure essere creata gia approvabile tramite flusso admin esplicito. La scelta prodotto va approvata;
- immagini e posizione seguono gli stessi vincoli;
- metriche possono distinguere report per fonte.

## 7. Modello duplicati

Principi:

- il duplicato non viene cancellato;
- resta nel DB;
- mantiene codice, origine, data, descrizione, allegati e storico;
- viene collegato a un report principale;
- l'azione e tracciata nel registro interno.

### Opzione A — `reports.duplicateOfReportId`

Pro:

- semplice;
- query facili;
- sufficiente se un report puo essere duplicato di uno solo principale;
- migration ridotta.

Contro:

- metadata del collegamento limitati;
- meno adatto se servono stati della relazione, note, autore, merge parziali;
- self-FK con controlli anti-ciclo da gestire in applicazione.

### Opzione B — tabella relazione `report_duplicates`

Campi possibili:

```text
report_duplicates
- duplicate_report_id PK/FK reports.id
- primary_report_id FK reports.id
- created_at
- created_by_admin_id nullable
- note nullable
```

Pro:

- conserva metadata;
- estendibile;
- piu pulita per audit;
- puo prevenire piu relazioni attive con PK su `duplicate_report_id`.

Contro:

- una join in piu;
- piu codice repository.

### Raccomandazione

P0-02 ha approvato e implementato l'opzione A con `reports.duplicate_of_report_id`. La motivazione operativa e mantenere il modello semplice: un duplicato punta a una sola principale, mentre audit e storico restano in `report_events`.

### Effetti da decidere

Se il duplicato non era pubblico:

- resta non pubblico e tracking codice puo mostrare messaggio generico o rimando alla principale, da decidere.

Se il duplicato era gia pubblico:

- opzione 1: resta scheda pubblica con avviso `Questa segnalazione e stata ricondotta a ...`;
- opzione 2: non appare piu in mappa/lista, ma il codice originale apre una pagina che rimanda alla principale;
- opzione 3: resta visibile ma non conta come problema separato.

Raccomandazione: prima versione, nascondere duplicati dalla mappa come problemi autonomi e mantenere tracking/dettaglio con rimando alla principale. Serve approvazione prodotto.

Conferme:

- non migrare automaticamente le conferme dal duplicato al principale senza decisione esplicita;
- per metriche pubbliche, evitare doppio conteggio se il duplicato viene nascosto;
- possibile futuro: mostrare conferme separate e aggregate solo sulla principale con label chiara.

## 8. Modello immagini

Stato attuale: `report_attachments` supporta un solo allegato per report, tipo `image`.

Target proposto:

```text
report_attachment_type:
- report_photo
- resolution_photo

report_attachment_review_status:
- pending
- approved
- blocked
- needs_review

report_attachments
- id
- report_id
- type
- storage_key
- mime_type
- size
- review_status
- review_reason nullable
- created_by_admin_id nullable
- created_at
- reviewed_at nullable
```

Modifiche:

- rimuovere o sostituire il vincolo unique su `report_id` con unique parziale per tipo se si vuole una sola foto per tipo;
- mantenere una sola `report_photo` caricata dal cittadino nella prima versione;
- consentire una `resolution_photo` caricata solo da admin;
- non servire pubblicamente attachment `blocked` o `needs_review`;
- evento interno quando un allegato viene bloccato/approvato.

Compatibilita:

- attachment esistenti: `type = report_photo`, `review_status = approved` se gia collegati a report approvati, oppure `pending`/`approved` da decidere. Per non bloccare dati gia pubblicati, backfill pragmatico: `approved`.

## 9. Modello Transmission

Questo e il punto strutturale piu importante.

Il futuro PEC non deve assumere `1 report = 1 PEC`. Serve un'entita capace di rappresentare una trasmissione verso un destinatario, collegata a una o piu segnalazioni.

Target:

```text
transmissions
- id
- recipient_id nullable
- recipient_name_snapshot
- recipient_organization_snapshot
- recipient_address_snapshot
- channel: email | pec
- subject
- body
- status: draft | sent | accepted | delivered | failed
- created_at
- sent_at nullable
- accepted_at nullable
- delivered_at nullable
- failed_at nullable
- external_message_id nullable
- acceptance_receipt_id nullable
- delivery_receipt_id nullable
- error_code nullable
- error_message nullable
- metadata jsonb nullable

transmission_reports
- transmission_id FK transmissions.id
- report_id FK reports.id
- sort_order integer
- primary key (transmission_id, report_id)
```

Per compatibilita con stato pubblico:

- `sent`: il messaggio e stato inviato al server/provider, ma non basta per `Comunicata`;
- `accepted`: ricevuta PEC di accettazione, se disponibile;
- `delivered`: ricevuta PEC di consegna o conferma manuale equivalente. Solo questo evento puo portare i report collegati a `Comunicata`;
- `failed`: errore o mancata consegna.

Per canali non-PEC, `accepted` potrebbe non esistere; `delivered` resta conferma manuale o provider-specific.

## 10. Relazione Transmission ↔ Report

Raccomandazione: N:M con tabella `transmission_reports`.

Motivi:

- supporta il caso attuale 1 transmission → 1 report;
- abilita trasmissioni aggregate senza riscrittura;
- evita duplicare contenuto della trasmissione su ogni report;
- consente una singola ricevuta PEC collegata a piu report;
- mantiene chiara la timeline di ciascun report tramite eventi generati per ogni report collegato.

Regola di stato:

- quando una transmission diventa `delivered`, ogni report collegato che e `approved + reported` puo passare a `communicated`;
- se un report collegato e gia `communicated` o `resolved`, non va retrocesso;
- se un report non e pubblico, non deve essere collegabile a una transmission operativa salvo flusso futuro esplicito.

## 11. Evoluzione di OutboundCommunication

Opzioni:

### 1. Rinominare `OutboundCommunication` in `Transmission`

Pro:

- modello unico;
- meno concetti nel codice;
- preserva gran parte di VC-015.

Contro:

- migration piu invasiva;
- bisogna introdurre subito relazione `transmission_reports`;
- test e UI da aggiornare.

### 2. `Transmission` sopra `OutboundCommunication`

Pro:

- meno rischio immediato;
- `OutboundCommunication` resta come dettaglio invio.

Contro:

- due concetti simili;
- rischio confusione;
- maggiore complessita futura.

### 3. Mantenere entrambe separate

Pro:

- nessuna migration iniziale.

Contro:

- il futuro PEC richiede duplicazione;
- non risolve il gap 1:N.

### Raccomandazione

Evolvere `OutboundCommunication` in `Transmission` con migration progressiva:

1. creare `transmission_reports`;
2. trattare ogni riga esistente di `outbound_communications` come una transmission legacy;
3. backfill `transmission_reports` da `outbound_communications.report_id`;
4. aggiornare application layer a un `TransmissionRepository` mantenendo tipi/alias temporanei se utile;
5. in una migration successiva, valutare rename tabella da `outbound_communications` a `transmissions`.

Questa strada non butta VC-015: riusa stati, snapshot destinatario, template, date, eventi e UI esistente, ma libera il modello dal vincolo 1:1.

## 12. Strategia registro interno

`report_events` puo restare il registro interno principale.

Estensioni event type consigliate:

- `ReportCategoryChanged`;
- `ReportSourceRecorded` o gestito solo nel creation metadata;
- `ReportMarkedAsDuplicate`;
- `ReportDuplicateLinkRemoved`;
- `ReportInternalNoteAdded`;
- `AttachmentReviewFlagged`;
- `AttachmentApproved`;
- `AttachmentBlocked`;
- `TransmissionCreated`;
- `TransmissionSent`;
- `TransmissionAccepted`;
- `TransmissionDelivered`;
- `TransmissionFailed`;
- `TransmissionReplyReceived`;
- `ReportVerificationRequested`;
- `ReportResolutionPhotoAdded`;
- `ReminderSuggested`;
- `ReminderSent`.

Non serve event sourcing: gli eventi servono come audit/timeline, mentre lo stato operativo principale resta su report, transmission, attachment e relazioni.

Per note interne, usare eventi interni con metadata `internalNote`, autore opzionale e data. Se le note diventano molte o editabili, introdurre entita dedicata piu avanti.

## 13. Intake manuale/fonti

Nuovo flusso target:

1. Admin apre `Nuova segnalazione manuale`.
2. Sceglie fonte: social, email, direct, other.
3. Inserisce categoria, posizione, descrizione ed eventuale foto.
4. Il sistema genera publicCode come per il form pubblico.
5. La segnalazione entra nello stesso workflow di moderazione o, se approvato come scelta prodotto, puo essere creata gia approvata con azione esplicita.
6. Timeline interna registra fonte e admin.

Raccomandazione: creare sempre `pending_review` anche da admin nella prima versione. Riduce eccezioni e mantiene il controllo editoriale esplicito. Si puo aggiungere un pulsante `Crea e approva` solo se approvato.

## 14. Conferme

La logica tecnica e adeguata per MVP:

- nessun account;
- cookie first-party anonimo;
- hash server-side come `antiAbuseKey`;
- unique DB per report + key;
- conteggio aggregato.

Limiti:

- un utente puo cancellare cookie o usare altro browser;
- non c'e rate limit specifico;
- non c'e analisi abuso su IP/User-Agent, correttamente evitata finora per privacy;
- non blocca automazioni distribuite.

Modifica P0 consigliata: copy pubblico neutro.

Copy target:

- `Nessuna conferma ricevuta`;
- `1 conferma ricevuta`;
- `27 conferme ricevute`;
- oppure `Questo problema e stato confermato 27 volte`.

Evitare:

- `cittadini`;
- `persone`;
- qualsiasi formulazione che suggerisca identita verificata.

## 15. Anti-abuso

Superficie pubblica:

- creazione report `/segnala`;
- upload foto;
- conferme;
- geocoding proxy `/api/geocoding/search` e `/api/geocoding/reverse`;
- tracking codice `/segnalazione`;
- pagine pubbliche dinamiche;
- futura newsletter.

### Protezioni obbligatorie prima del go-live (P1)

- rate limiting server-side su creazione report;
- rate limiting su upload foto;
- rate limiting su conferme;
- rate limiting su geocoding proxy;
- limiti upload confermati e documentati;
- verifica MIME reale gia presente, da mantenere;
- log abuso minimali con retention definita;
- messaggi non enumerativi per report non pubblici/rifiutati;
- configurazione limiti via env dove sensato.

### Protezioni consigliate (P1/P2)

- Turnstile o alternativa privacy-friendly se appare spam reale;
- honeypot sul form pubblico;
- delay/backoff progressivo per azioni pubbliche;
- dashboard admin semplice per tentativi bloccati.

### Differibili (P2)

- CAPTCHA obbligatorio sempre attivo;
- scoring antifrode complesso;
- fingerprinting browser;
- reputazione utente.

Privacy tradeoff:

- evitare fingerprinting aggressivo;
- se si usano IP per rate limit, preferire hashing con sale rotabile e retention breve;
- non mostrare mai dati anti-abuso nel backoffice salvo aggregati tecnici necessari.

## 16. Privacy immagini

Pipeline proposta:

1. Upload immagine.
2. Validazione dimensione/MIME reale.
3. Normalizzazione con `sharp` e rimozione metadata, gia esistente.
4. Salvataggio privato.
5. Detector privacy opzionale su immagine normalizzata.
6. Se il detector segnala volto/targa/dato identificativo: attachment `needs_review` o `blocked`.
7. Admin vede alert e decide: rifiutare segnalazione, sostituire/omettere foto, approvare manualmente se non problematica.
8. Pubblico vede solo attachment `approved`.

Prima versione desiderata:

- preferire strumenti gratuiti/open source;
- non pubblicare automaticamente immagini segnalate dal detector;
- fallback in caso errore detector: `needs_review`, non pubblicazione automatica;
- umano sempre responsabile della decisione.

Decisioni privacy aperte:

- usare detector locale o servizio esterno;
- conservare o eliminare immagini bloccate;
- policy per foto con targhe/volti sfocabili;
- eventuale strumento di blur manuale;
- retention allegati rifiutati.

## 17. Foto risoluzione

La foto dopo intervento va modellata come attachment distinto:

- `type = resolution_photo`;
- caricabile solo da admin;
- collegata allo stesso report;
- pubblicabile solo se `review_status = approved`;
- mostrata nella scheda pubblica in sezione distinta dalla foto originale;
- registrata in timeline admin e, se pubblica, come parte dell'evento `ReportResolved` o evento `ReportResolutionPhotoAdded`.

Raccomandazione: riusare storage e processing esistenti, aggiungendo solo tipo/stato e UI admin.

## 18. Solleciti futuri

Non serve automazione ora.

Modello futuro leggero:

- `Transmission.nextActionAt` opzionale oppure evento `ReminderSuggested`;
- `ReminderSent` come transmission separata collegata alla precedente o come tipo di transmission;
- numero solleciti derivabile dagli eventi/transmission collegate;
- invio sempre confermato manualmente nella prima versione.

Raccomandazione: non creare tabella dedicata ora. Preparare il modello `Transmission` in modo da poter aggiungere `parentTransmissionId` o `reason = reminder` in futuro senza riscrittura.

## 19. Compatibilita/migration plan

| Modifica | Migration | Backward compatibility | Default/backfill | Rischio perdita dati |
| --- | --- | --- | --- | --- |
| `reports.source` | Si | Alta | `platform` per tutti i report esistenti | Basso |
| `created_by_admin_id` opzionale | Si, completata in P0-01B | Alta | null | Basso |
| Duplicati post-submit | Si | Alta | nessuna relazione esistente | Basso |
| Event types aggiuntivi | Si se enum PG | Alta | nessun backfill obbligatorio | Basso |
| Attachment type `report_photo/resolution_photo` | Si | Media | attachment esistenti → `report_photo` | Medio per vincoli unique |
| Attachment review status | Si | Alta | esistenti → `approved` o `pending`, consigliato `approved` per non rompere pubblicazioni | Basso/medio |
| `transmission_reports` | Si | Alta | una riga per ogni outbound communication esistente | Basso |
| Rename `outbound_communications` | Si, differibile | Media | mantenere alias applicativo temporaneo | Medio |
| `acceptedAt`/ricevute PEC | Si | Alta | null | Basso |
| Copy conferme | No | Alta | n/a | Nessuno |
| Rate limit/abuse log | Possibile | Alta | nessun backfill | Basso |

## 20. Impatto UI/UX

### `/segnala`

- Nessun cambio obbligatorio per source; resta `platform`.
- Duplicati pre-submit invariati.
- Potrebbe mostrare copy conferme solo indirettamente nei duplicati.
- Privacy immagini puo aggiungere messaggio sul fatto che foto con dati identificativi potrebbero non essere pubblicate.

### `/segnalazione`

- Se un codice appartiene a duplicato post-submit, serve decidere se rimandare alla principale o mostrare stato specifico.
- Nessun dettaglio interno.

### `/segnalazioni/[publicCode]`

- Copy conferme da aggiornare.
- Possibile avviso `Segnalazione ricondotta a...` per duplicati.
- Foto originale e foto risoluzione come sezioni distinte.
- Timeline pubblica resta filtrata.

### `/mappa`

- Duplicati post-submit non dovrebbero apparire come problemi autonomi se scelta prodotto confermata.
- Risolte restano accessibili da filtro come gia definito nella UX mappa.
- Nessun workflow interno esposto.

### `/admin`

- Metriche potrebbero distinguere fonti, creatore admin/manuale, duplicati, trasmissioni da consegnare, immagini da revisionare.
- Hardening/abuse non necessariamente visibile nella prima versione.

### `/admin/segnalazioni`

- Pulsante `Nuova segnalazione manuale` e audit creatore admin disponibili.
- Filtri futuri: fonte, duplicati, fase operativa derivata, immagini da revisionare.
- Non introdurre troppi filtri prima del modello stabilizzato.

### `/admin/segnalazioni/[publicCode]`

- Mostrare source.
- Azione `Segna come duplicata`.
- Sezione allegati con review privacy e foto risoluzione.
- Comunicazioni da evolvere verso trasmissioni.
- Registro interno arricchito.

### Futuro `/admin/trasmissioni`

- Lista transmission draft/sent/delivered/failed.
- Possibile creazione transmission con piu report stesso destinatario.
- Gestione ricevute PEC, risposte, solleciti.

## 21. Lista interventi P0/P1/P2

### P0 — Da fare prima del redesign UI/UX

Interventi strutturali che cambiano schermate o workflow:

1. Definire e implementare duplicati post-submit. Completato in P0-02.
2. Evolvere `OutboundCommunication` verso `Transmission` con relazione 1:N report.
3. Estendere modello attachment per tipo/stato review almeno a livello dati.
4. Preparare foto risoluzione come `resolution_photo` se prevista nella UI finale.
5. Estendere event types per registro interno minimo: duplicati, attachment review, transmission.
6. Definire workflow operativo interno come derived state e non come nuovi stati pubblici.

Completati in P0-01/P0-01B: `Report.source`, intake manuale admin, copy conferme neutro e `createdByAdminId` audit.

### P1 — Da definire prima del go-live

1. Rate limiting pubblico.
2. Abuse logging con policy retention.
3. Strategia privacy immagini e scelta detector.
4. Policy retention/log/privacy completa.
5. Hardening geocoding proxy.
6. Strategia PEC reale su modello Transmission.
7. Backup/restore e monitoring produzione.
8. Metriche aggiornate per fonte/duplicati/transmission dove utili.

### P2 — Può essere aggiunto successivamente

1. Solleciti semi-automatici o suggeriti.
2. Dashboard avanzata trasmissioni.
3. Batch settimanali o trasmissioni aggregate automatiche.
4. Risposte inbound PEC con parsing avanzato.
5. Detector privacy con blur automatico.
6. Scoring anti-abuso complesso.
7. Reopen/report ricomparso.
8. Workflow operativo persistito se le code derivate non bastano.

## 22. Decisioni ancora aperte

- Duplicato pubblico: deve restare accessibile con avviso, essere nascosto dalla mappa o redirigere alla principale?
- Conferme su duplicati: restano separate o vengono aggregate sulla principale?
- Attachment esistenti: backfill `review_status = approved` o `pending`?
- Foto risoluzione obbligatoria, opzionale o solo quando disponibile?
- Transmission: rinominare subito `outbound_communications` o introdurre `transmission_reports` mantenendo nome legacy per una fase?
- Stato `accepted` PEC va introdotto subito nel modello o solo con VC-019B?
- Detector immagini: locale/open source o servizio esterno?
- Rate limit: implementazione self-hosted, middleware, reverse proxy o servizio esterno?
- Retention di immagini rifiutate/bloccate e log anti-abuso.
- Policy per targhe/volti: blocco, blur, approvazione manuale o rifiuto.

## 23. Sequenza consigliata delle prossime task

1. `MVP-003/P0-02 — Duplicati post-submit`: completato con `reports.duplicate_of_report_id`, eventi, azione admin, comportamento pubblico, conferme e mappa.
2. `MVP-004 — Attachment model v2`: tipo attachment, review status, backfill, compatibilita foto esistente.
3. `MVP-005 — Foto risoluzione`: upload admin `resolution_photo`, rendering pubblico, evento timeline.
4. `MVP-006 — Transmission foundation`: introdurre relazione `transmission_reports`, aggiornare repository/use case mantenendo compatibilita VC-015.
5. `MVP-007 — Registro interno esteso`: nuovi event type e note operative minime.
6. `MVP-008 — Anti-abuso pre-go-live`: rate limit, abuse logging, hardening geocoding/upload/conferme.
7. `MVP-009 — Privacy image review`: detector/fallback/manual review dopo decisione privacy.
8. `MVP-010 — UI/UX redesign`: iniziare solo dopo i P0 strutturali che cambiano schermate e workflow.

Completati: `MVP-001` per copy conferme neutro e `MVP-002` per `reports.source` + intake manuale admin.

## 24. Nota finale

La raccomandazione principale e non trasformare Visione Comune in un gestionale per Comuni. Gli enti restano fuori dal backoffice; la piattaforma raccoglie, verifica, pubblica, trasmette e monitora. Il workflow operativo interno deve aiutare Visione Comune senza contaminare l'esperienza pubblica, che deve restare semplice e comprensibile.

## 25. Decisioni operative consolidate P0-01B

- Moderazione manuale sempre obbligatoria prima della pubblicazione, anche per report manuali o provenienti da canali conosciuti.
- Pre-filtro automatico futuro ammesso solo per problemi oggettivi e tecnici; la validita sostanziale resta umana.
- Macro-categorie semplici: poche categorie comprensibili e operative, senza gerarchia obbligatoria nel modello attuale.
- Routing verso enti tramite matrice `Category → category_recipients → Recipient`, senza PEC duplicata su `categories`.
- Direzione futura per comunicazioni: trasmissioni aggregate per destinatario, con frequenza/soglie configurabili da testare.
- Principio anti-spam verso gli enti: tracciabilita delle singole segnalazioni, ma comunicazioni aggregate quando opportuno.


## P0-02 implementata

### P0-02 — Duplicati post-submit

Gli amministratori possono collegare una segnalazione a una segnalazione principale dopo la creazione. Il duplicato resta nel database, mantiene codice pubblico, fonte, allegati, storico e conferme gia ricevute. Non viene eseguito alcun merge fisico e non vengono trasferiti conferme, foto o eventi alla principale.

La relazione e modellata con `reports.duplicate_of_report_id`, nullable FK verso `reports.id`. `null` indica una segnalazione normale; un valore indica che la segnalazione e duplicata di una principale. Il database impedisce il self-link diretto; l'application layer permette come target solo una segnalazione approvata, pubblica e non duplicata, evitando catene A -> B -> C.

Una segnalazione duplicata pubblica resta raggiungibile tramite URL e tracking code. La scheda pubblica mostra un avviso e un link alla principale, senza redirect automatico. I duplicati sono esclusi dalla mappa pubblica e dalle liste aggregate principali per non creare rumore. Le nuove conferme sono disabilitate sul duplicato e raccolte sulla principale; le conferme gia presenti sul duplicato restano storiche e non vengono sommate automaticamente alla principale.

Le metriche operative conteggiano ancora `totalReceived` come totale storico delle segnalazioni ricevute, inclusi duplicati. I conteggi di problemi pubblicati/comunicati/risolti, distribuzioni pubbliche e tempi operativi escludono invece i duplicati per non gonfiare il numero di problemi unici.
