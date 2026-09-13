# PEC Integration Plan — VC-019A

Stato: proposta tecnica da approvare. Questo documento non implementa il provider PEC reale e non cambia il flusso applicativo.

Data analisi: 2026-09-13.

## 1. Approccio consigliato

Per l'MVP avanzato di Visione Comune consiglio un'integrazione in due livelli:

1. **Adapter PEC astratto nel core applicativo**, indipendente dal provider.
2. **Primo provider reale basato su SMTP + IMAP**, con invio via SMTP autenticato e riconciliazione ricevute via polling IMAP.

Questa scelta e la piu coerente con il progetto perche:

- mantiene costi iniziali bassi;
- funziona con la maggior parte delle caselle PEC italiane;
- e deployabile sul VPS Node.js gia previsto;
- non vincola subito Visione Comune a un vendor API specifico;
- permette test locali con adapter finto e fixture MIME senza usare una casella reale;
- rispetta BR-007: lo stato pubblico `Comunicata` deve derivare solo da consegna confermata, non da semplice invio.

L'implementazione futura deve comunque mantenere un'interfaccia `PecProvider` o equivalente, cosi un provider API proprietario o un intermediario potra sostituire SMTP/IMAP senza riscrivere dominio, `OutboundCommunication` o timeline.

## 2. Alternative analizzate

### 2.1 SMTP + IMAP standard

Descrizione:

- invio messaggi PEC tramite SMTP della casella;
- lettura inbox/cartelle via IMAP;
- polling periodico per ricevute di accettazione, consegna, mancata consegna e risposte;
- parsing MIME dei messaggi e degli allegati PEC.

Valutazione:

- Fattibilita: alta, se la casella PEC scelta espone SMTP e IMAP.
- Affidabilita: buona, ma dipende dalla qualita del parser, dalla configurazione cartelle e dalla stabilita IMAP.
- Complessita: media. L'invio e semplice; la parte delicata e riconoscere correttamente ricevute e risposte.
- Portabilita: alta tra provider PEC tradizionali.
- Lock-in: basso.
- Ricevute: disponibili come messaggi PEC ricevuti nella casella mittente; vanno classificate.
- Reply: disponibili via IMAP, da associare con subject e header.
- Polling vs webhook: polling, perche IMAP non fornisce webhook HTTP nativi.
- Sicurezza credenziali: richiede credenziali SMTP/IMAP della casella PEC in env var o secret manager.
- Costi: costo della casella PEC; nessun costo per richiesta API.
- Sviluppo locale: buono con adapter finto e fixture; test reali richiedono casella PEC dedicata.
- Deploy VPS: semplice, se il VPS puo aprire connessioni TLS verso SMTP/IMAP del provider.

Rischio principale:

- il parser deve essere conservativo. Un messaggio non classificato non deve cambiare automaticamente stato.

### 2.2 API proprietarie del provider PEC

Descrizione:

- uso di API REST del provider per inviare, leggere o gestire PEC;
- eventuali callback/webhook se documentati dal provider.

Valutazione:

- Fattibilita: variabile. Alcuni operatori hanno API per provisioning/gestione PEC; non sempre e documentato l'invio/ricezione operativa via API per la singola casella.
- Affidabilita: potenzialmente alta se l'API espone eventi strutturati di accettazione/consegna/fallimento.
- Complessita: bassa lato parsing se l'API restituisce stati strutturati; alta lato integrazione commerciale/contrattuale.
- Portabilita: bassa o media.
- Lock-in: medio/alto.
- Ricevute: ottime solo se l'API espone ricevute normalizzate; altrimenti si torna a IMAP.
- Reply: dipende dal provider.
- Polling vs webhook: da verificare. Le API pubbliche individuate non garantiscono webhook ricevute per tutti i provider.
- Sicurezza credenziali: token API, rotazione, scope e audit.
- Costi: possibili costi per richiesta o piano API.
- Sviluppo locale: buono se esistono sandbox; altrimenti serve mocking.
- Deploy VPS: semplice lato HTTP, ma dipende da IP allowlist, webhook pubblici e TLS.

Rischio principale:

- non bisogna assumere endpoint di invio/ricezione PEC se non sono documentati nel contratto scelto.

### 2.3 Provider/intermediario con API dedicate

Descrizione:

- un intermediario API gestisce attivazione/gestione PEC o servizi collegati;
- Visione Comune integra l'intermediario invece del gestore PEC diretto.

Valutazione:

- Fattibilita: interessante se l'intermediario espone invio, stato e ricevute in modo strutturato.
- Affidabilita: potenzialmente alta, ma da verificare su ricevute reali e responsabilita legale.
- Complessita: bassa lato app, alta lato valutazione contrattuale.
- Portabilita: media. L'app resta isolata tramite adapter, ma il contratto e i dati passano dal provider terzo.
- Lock-in: medio.
- Ricevute: dipende dalle API esposte.
- Reply: dipende dalle API esposte.
- Polling vs webhook: da verificare provider per provider.
- Sicurezza credenziali: token API piu eventuali credenziali PEC gestite dal provider.
- Costi: possibili costi per richiesta API oltre al costo della PEC.
- Sviluppo locale: buono se sandbox disponibile.
- Deploy VPS: buono se solo HTTPS.

Rischio principale:

- alcuni servizi API PEC sembrano orientati a provisioning/gestione caselle, non necessariamente all'automazione completa di invio, ricevute e risposte.

## 3. Provider valutati

Le informazioni qui sotto derivano da documentazione pubblica disponibile al 2026-09-13. Dove non e disponibile documentazione certa su API, webhook o ricevute, la voce resta da verificare manualmente prima della scelta.

### Aruba PEC

Fonti consultate:

- pagina commerciale PEC Aruba/Pec.it: `https://www.pec.it/`
- guide Aruba con sezione PEC e configurazione client: `https://guide.aruba.it/`

Evidenze:

- Aruba pubblica piani PEC con costo iniziale da 5,00 € + IVA per il primo anno e rinnovo da 9,90 € + IVA/anno nella pagina Pec.it consultata.
- La documentazione Aruba espone una sezione PEC con guide per Webmail, app e programmi di posta.
- La pagina guide indica la configurazione su client di posta come percorso documentato.

Valutazione:

- SMTP: probabile/supportato tramite configurazione client, da verificare sul piano scelto e sulle credenziali effettive.
- IMAP: probabile/supportato tramite configurazione client, da verificare sul piano scelto.
- API: non ho trovato, nelle fonti pubbliche consultate, una API documentata per invio/ricezione PEC applicativa con ricevute e webhook.
- Webhook: non documentati nelle fonti consultate per PEC operativa.
- Ricevute: via messaggi PEC nella casella mittente; accessibili via Webmail/client e quindi verosimilmente via IMAP se abilitato.
- Limiti: spazio casella/piano; limiti invio da verificare contrattualmente.
- Costi: bassi per casella base; eventuali piani Pro/Premium da valutare se serve spazio/archivio.
- Vincoli: gestione credenziali e possibile necessita di impostazioni specifiche per accesso da client.

Adattabilita al progetto:

- buona per approccio SMTP/IMAP a basso costo.
- non consiglierei di basare l'MVP su API Aruba perche non sono state individuate API PEC operative documentate per questo caso.

### Tinexta InfoCert / Legalmail

Fonti consultate:

- pagina InfoCert Legalmail: `https://www.infocert.it/pec`
- pagina Legalmailpec: `https://www.legalmailpec.it/`
- guida configurazione Legalmail segnalata da help InfoCert nei risultati di ricerca.

Evidenze:

- InfoCert pubblica piani Legalmail con prezzi indicativi: Personal 5,90 € + IVA/anno, Professional 15,90 € + IVA/anno, Bronze in promo 18,90 € + IVA/anno nella pagina consultata.
- La pagina InfoCert specifica differenze di piano: per esempio Personal con 5 messaggi inclusi e ricezione illimitata; Bronze con messaggi illimitati.
- La configurazione client Legalmail documentata pubblicamente indica IMAP su `mbox.cert.legalmail.it` porta 993 e SMTP su `sendm.cert.legalmail.it` porta 465.
- Legalmailpec mostra collegamento ad API OpenAPI.it, ma questo non prova da solo l'esistenza di API operative per invio/ricezione ricevute nella casella.

Valutazione:

- SMTP: documentato per client Legalmail.
- IMAP: documentato per client Legalmail.
- API: esiste ecosistema API InfoCert/OpenAPI, ma va verificato se copre invio/ricezione, ricevute e reply matching, non solo provisioning o gestione caselle.
- Webhook: non verificati per ricevute PEC operative.
- Ricevute: via messaggi PEC nella casella mittente; accessibili via IMAP.
- Limiti: dipendono dal piano; attenzione ai piani con numero limitato di invii.
- Costi: bassi per uso occasionale, ma per Visione Comune servirebbe un piano con invii sufficienti/illimitati.
- Vincoli: scelta piano importante per evitare limiti invio troppo stretti.

Adattabilita al progetto:

- molto buona per SMTP/IMAP.
- potenzialmente interessante per evoluzione API, ma solo dopo verifica contrattuale/documentale.

### Namirial / Sicurezza Postale

Fonti consultate:

- documentazione pubblica Sicurezza Postale Namirial per configurazione client: `https://www.sicurezzapostale.it/`
- service desk Namirial su errori/mancata consegna.
- OpenAPI.it include voci prezzo relative a servizi Namirial.

Evidenze:

- La documentazione Sicurezza Postale indica accesso alla casella tramite comuni client di posta e descrive IMAP/POP.
- Il supporto Namirial documenta casi di mancata consegna, incluso superamento del tempo massimo.
- OpenAPI.it mostra nel proprio listino voci relative a servizi Namirial, ma questo non dimostra automaticamente disponibilita di invio/ricezione ricevute via API per una casella Visione Comune.

Valutazione:

- SMTP: da verificare nei parametri del piano/casella scelta; fonti pubbliche indicano configurazione client.
- IMAP: indicato nella documentazione client.
- API: da verificare. OpenAPI.it menziona servizi Namirial ma non basta per assumere automazione completa.
- Webhook: non verificati nelle fonti consultate.
- Ricevute: presumibilmente via messaggi PEC nella casella mittente.
- Limiti: piano/casella da verificare.
- Costi: da verificare sul listino Namirial aggiornato; la pagina ufficiale trovata non esponeva un listino semplice nella parte consultabile.
- Vincoli: verificare accesso IMAP/SMTP, eventuali app password o limitazioni sicurezza.

Adattabilita al progetto:

- buona se SMTP/IMAP sono disponibili stabilmente.
- da approfondire se si vuole un servizio con conservazione integrata o dominio PEC dedicato.

### Register.it

Fonti consultate:

- pagina PEC Register.it: `https://www.register.it/pec/`
- listino prezzi Register.it: `https://www.register.it/company/listino-prezzi/`

Evidenze:

- Il listino prezzi consultato indica: PEC Agile 54,15 € + IVA, PEC unica 3GB 68,60 € + IVA, PEC unica 5GB 108,35 € + IVA.
- La pagina PEC segnala promozioni temporanee e rinnovo successivo.
- La documentazione pubblica individuata rimanda a configurazioni client email, ma per dettagli SMTP/IMAP operativi va verificata la guida specifica del prodotto acquistato.

Valutazione:

- SMTP: da verificare sul piano scelto.
- IMAP: da verificare sul piano scelto.
- API: non individuate API PEC operative pubbliche per invio/ricezione ricevute.
- Webhook: non individuati.
- Ricevute: se accesso client disponibile, via IMAP.
- Limiti: piano e spazio da verificare.
- Costi: piu alti rispetto ad Aruba/alcuni piani Legalmail.
- Vincoli: valutare rinnovi e condizioni promo.

Adattabilita al progetto:

- tecnicamente plausibile con SMTP/IMAP, ma meno interessante se il costo resta superiore e non offre API operative documentate.

### OpenAPI.it come intermediario

Fonti consultate:

- pagina prezzi API PEC OpenAPI.it: `https://console.openapi.com/it/apis/pec/pricing`

Evidenze:

- OpenAPI.it dichiara API per attivare e gestire servizi PEC, inclusi InfoCert Legalmail, Domicilio Digitale e Pecmassiva.
- Il listino mostra endpoint come `POST /pec`, `GET /pec`, `PATCH /pec`, `GET /verifica_pec`, `POST /comunica_pec`, `GET /comunica_pec`, `PATCH /comunica_pec`.
- I prezzi sono per richiesta o per operazione e includono voci a pagamento anche rilevanti.

Valutazione:

- SMTP/IMAP: non e il focus dell'intermediario; resterebbe comunque possibile se la casella sottostante lo consente.
- API: documentate per attivazione/gestione PEC. Da verificare se `comunica_pec` copre anche invio/ricezione operativa, ricevute e reply matching necessari al progetto.
- Webhook: non emersi dalla pagina prezzi consultata.
- Ricevute: da verificare se l'API restituisce ricevute strutturate o solo gestione servizio.
- Costi: potenzialmente piu alti di SMTP/IMAP per un progetto civico con budget basso.
- Vincoli: dipendenza da intermediario, wallet, termini API e responsabilita sul trattamento messaggi.

Adattabilita al progetto:

- utile da rivalutare se serve provisioning caselle o gestione dominio PEC via API.
- non consigliato come prima implementazione finche non e verificata la copertura completa di invio, ricevute e risposte.

## 4. Prerequisiti

Prima di VC-019B servono decisioni operative:

- casella PEC dedicata a Visione Comune, distinta da caselle personali;
- provider PEC e piano scelto;
- conferma che il piano abiliti SMTP e IMAP con TLS;
- credenziali tecniche dedicate, se il provider le supporta;
- criteri retention dei messaggi PEC e ricevute;
- scelta se conservare solo metadati e allegati essenziali o anche copia MIME completa;
- volume previsto di invii mensili;
- policy su allegati inviati via PEC;
- indirizzo mittente ufficiale e firma testuale standard;
- decisione su conservazione a norma: fuori dal core applicativo o tramite servizio provider.

Prerequisiti tecnici applicativi:

- adapter `PecProvider` vicino al modulo communications/application o in modulo `integrations/pec`;
- modello dati esteso per ricevute/eventi PEC, senza sovraccaricare `OutboundCommunication`;
- job runner o comando schedulato per polling IMAP;
- parser MIME testabile con fixture;
- idempotenza forte su UID IMAP, Message-ID e tipo ricevuta.

## 5. Mapping eventi PEC → OutboundCommunication

Regola guida:

- `sent` non significa `Comunicata`.
- `delivered` significa consegna confermata dalla ricevuta PEC di avvenuta consegna.
- solo `delivered` puo causare `Report.markCommunicated` e quindi `ReportCommunicated` pubblico.

Mapping proposto:

| Evento reale | Stato comunicazione | Effetto su report | Evento timeline |
| --- | --- | --- | --- |
| Bozza interna non inviata | `draft` | nessuno | `CommunicationRecorded` interno |
| SMTP accetta il messaggio per invio | non definitivo; al massimo `sent` provvisorio con flag tecnico | nessuno | evento tecnico interno futuro, se introdotto |
| Ricevuta PEC di accettazione | `sent` | nessuno | `CommunicationSent` interno |
| Ricevuta PEC di avvenuta consegna | `delivered` | se report e `Segnalata`, passa a `Comunicata` | `CommunicationDelivered` interno + `ReportCommunicated` pubblico |
| Avviso di mancata accettazione | `failed` | nessuno | `CommunicationFailed` interno |
| Avviso di mancata consegna / errore / superamento tempo massimo | `failed` | nessuno | `CommunicationFailed` interno |
| Risposta normale dell'ente | non cambia automaticamente `status` | nessuno automatico | evento inbound interno futuro |

Nota importante:

- l'invio SMTP accettato dal server non deve essere considerato prova PEC sufficiente. La prima conferma giuridicamente rilevante lato mittente e la ricevuta di accettazione; la comunicazione pubblica richiede ricevuta di consegna.

## 6. Strategia ricevute

La strategia futura deve classificare ogni messaggio PEC ricevuto nella casella mittente come uno dei seguenti:

- ricevuta di accettazione;
- ricevuta di avvenuta consegna;
- mancata accettazione;
- mancata consegna;
- messaggio normale;
- risposta dell'ente;
- messaggio non classificato.

Segnali da usare in combinazione:

1. **Oggetto**
   - cercare prefissi/testi tipici delle ricevute PEC;
   - cercare sempre `[VC-XXXXXXXX]` o `VC-XXXXXXXX`.
2. **Message-ID del messaggio originale**
   - salvare l'ID generato/ottenuto in invio;
   - confrontare con riferimenti nelle ricevute, se disponibili.
3. **Header `In-Reply-To` / `References`**
   - utili per risposte normali e thread.
4. **Allegati PEC**
   - le ricevute spesso contengono allegati XML/EML firmati o buste di trasporto;
   - parsing conservativo degli XML quando presenti.
5. **Mittente tecnico**
   - mittenti del gestore PEC hanno pattern ricorrenti, ma non devono essere l'unico segnale.
6. **Destinatario e subject originale**
   - confrontare indirizzo ente e oggetto generato dalla piattaforma.

Classificazione conservativa:

- se i segnali sono insufficienti, il messaggio resta `unclassified` e viene mostrato in admin per revisione manuale;
- nessun messaggio incerto deve causare `delivered`;
- un evento duplicato deve essere ignorato senza creare seconda transizione.

## 7. Strategia reply matching

Strategia consigliata:

1. Oggetto generato dalla piattaforma con codice ben visibile:
   - formato consigliato: `[VC-XXXXXXXX] Segnalazione civica - categoria - luogo`.
2. `OutboundCommunication.externalMessageId` valorizzato con il Message-ID del messaggio inviato o con ID provider/API se disponibile.
3. Salvataggio futuro di metadati aggiuntivi:
   - `providerMessageId`;
   - `smtpMessageId`;
   - `imapUid`;
   - `receiptType`;
   - `rawSubject`;
   - `receivedAt`.
4. Matching in ordine di confidenza:
   - match esatto su Message-ID/In-Reply-To/References;
   - match su codice pubblico `VC-XXXXXXXX` nell'oggetto;
   - match su destinatario + oggetto normalizzato + finestra temporale;
   - fallback manuale admin.

Il codice pubblico nell'oggetto e essenziale perche molti enti rispondono cambiando client, inoltrando messaggi o perdendo header di thread.

## 8. Strategia polling/webhook

### Polling IMAP consigliato per MVP

Frequenza iniziale:

- ogni 10 minuti in orario operativo;
- ogni 30 minuti fuori orario, se si introduce una distinzione;
- in alternativa semplice: ogni 10-15 minuti sempre.

Motivo:

- Visione Comune non richiede realtime al secondo;
- riduce carico e rischio blocchi provider;
- e sufficiente per aggiornare stato `Comunicata` in modo tempestivo.

Strategia tecnica:

- mantenere checkpoint per cartella: ultimo UID visto / UIDVALIDITY;
- rileggere una piccola finestra recente per tollerare race e riconnessioni;
- idempotenza su chiave `(provider, mailbox, folder, uid)` e/o `(messageId, receiptType)`;
- spostare o marcare come processati solo dopo parsing e persistenza riusciti;
- lasciare messaggi originali nella casella salvo decisione retention esplicita.

### Webhook

Da usare solo se il provider scelto documenta webhook affidabili per:

- ricevuta accettazione;
- ricevuta consegna;
- mancata consegna;
- messaggi inbound/reply.

Requisiti webhook:

- endpoint HTTPS pubblico sul VPS;
- firma HMAC o verifica equivalente;
- idempotency key;
- retry safe;
- log senza contenuti sensibili;
- fallback polling o procedura manuale se webhook fallisce.

## 9. Sicurezza

Credenziali:

- salvare `PEC_SMTP_HOST`, `PEC_SMTP_PORT`, `PEC_IMAP_HOST`, `PEC_IMAP_PORT`, `PEC_USERNAME`, `PEC_PASSWORD` solo in env locali/produzione, mai in Git;
- preferire credenziali dedicate/app password se disponibili;
- ruotare le credenziali dopo test iniziali e prima del go-live;
- account PEC dedicato a Visione Comune, non condiviso con uso umano quotidiano se possibile.

Connessioni:

- TLS obbligatorio per SMTP e IMAP;
- verificare certificati server;
- timeout e retry limitati;
- nessun fallback plaintext.

Logging:

- non loggare body, allegati, password, token, ricevute complete o dati personali;
- loggare solo ID comunicazione, publicCode, tipo evento, timestamp, provider e risultato tecnico.

Retention:

- decisione aperta: conservare MIME completo nel database/storage oppure solo metadati e lasciare valore legale alla casella PEC/archivio provider;
- per MVP consiglio di salvare metadati, subject, tipo ricevuta, hash del messaggio e riferimenti IMAP, evitando copia completa finche privacy/retention non sono approvate.

Backup:

- backup database include metadati e stati;
- backup casella/archivio PEC resta responsabilita del provider o di servizio di conservazione;
- prima del go-live serve test restore almeno dei metadati applicativi.

Segregazione:

- account PEC dedicato;
- accesso admin al backoffice separato da accesso alla casella;
- nessuna esposizione pubblica di ricevute, indirizzi tecnici o risposte ente.

## 10. Costi

Indicazioni pubbliche rilevate al 2026-09-13:

- Aruba PEC: pagina Pec.it indica PEC da 5,00 € + IVA per il primo anno, rinnovo da 9,90 € + IVA/anno.
- InfoCert Legalmail: pagina InfoCert indica Personal 5,90 € + IVA/anno, Professional 15,90 € + IVA/anno, Bronze in promo 18,90 € + IVA/anno; attenzione ai limiti messaggi dei piani base.
- Register.it: listino indica PEC Agile 54,15 € + IVA, PEC unica 3GB 68,60 € + IVA, PEC unica 5GB 108,35 € + IVA.
- OpenAPI.it: listino API PEC a richiesta; ad esempio `POST /pec` con prezzi dipendenti dal tipo servizio e `POST /comunica_pec` indicato a 15,700 €/richiesta nella pagina consultata. Va verificato cosa copre esattamente.
- Namirial: costo da verificare su listino commerciale aggiornato; fonti consultate non davano un listino ufficiale semplice per la casella adatta.

Per Visione Comune, la voce piu importante non e solo il canone: serve verificare invii inclusi/illimitati, spazio, archivio, accesso IMAP/SMTP e condizioni di conservazione.

## 11. Rischi

- Parsing ricevute incompleto o differente tra provider.
- Ricevute duplicate o recapitate in cartelle diverse.
- Messaggi senza codice pubblico nel subject per risposte manuali dell'ente.
- Casella piena o piano con spazio insufficiente.
- Rate limit o blocchi se polling troppo frequente.
- Credenziali PEC compromesse.
- Log o backup con contenuti PEC sensibili.
- Mancata chiarezza su valore legale se si conserva solo metadati nell'app.
- Provider API non copre realmente invio/ricezione ricevute nonostante offra API di provisioning.
- Rischio di aggiornare `Comunicata` su ricevuta sbagliata se matching non e conservativo.

## 12. Decisioni ancora aperte

- Provider PEC definitivo.
- Piano/casella da acquistare.
- Conferma accesso SMTP/IMAP e parametri tecnici.
- Eventuale uso di API provider/intermediario invece di SMTP/IMAP.
- Necessita o meno di dominio PEC dedicato.
- Strategia di conservazione a norma.
- Retention di messaggi, ricevute e allegati.
- Se salvare MIME completo, allegati o solo metadati/hash.
- Frequenza polling definitiva.
- Policy per risposte ente e allegati inbound.
- Se le risposte inbound devono generare eventi admin, notifiche o solo inbox interna.
- Strategia di alert se una comunicazione resta `sent` senza consegna oltre una soglia.

## 13. Piano di implementazione VC-019B

VC-019B dovrebbe essere una vertical slice tecnica piccola e verificabile, ancora senza dipendere da un provider reale in produzione.

### VC-019B.1 — Contratti e modello eventi PEC

Obiettivo:

definire `PecProvider`, `PecMessage`, `PecReceipt`, errori e use case applicativi.

Scope:

- contratti TypeScript;
- classificazione ricevute;
- use case per registrare accettazione, consegna, fallimento e risposta;
- idempotenza applicativa;
- nessuna connessione reale.

Risultato verificabile:

- unit test su mapping ricevute → stato comunicazione/report.

### VC-019B.2 — Schema dati ricevute/inbound

Obiettivo:

persistenza minima per eventi PEC.

Possibili tabelle:

- `pec_messages` o `inbound_communications`;
- `pec_receipts`;
- riferimenti a `outbound_communications` e `reports`.

Campi minimi:

- id;
- communicationId nullable;
- reportId nullable;
- provider;
- mailbox;
- folder;
- uid;
- messageId;
- inReplyTo;
- subject;
- receiptType;
- receivedAt;
- processedAt;
- rawHash;
- classificationStatus;
- metadata JSONB limitato.

Risultato verificabile:

- migration + integration test idempotenza.

### VC-019B.3 — Parser MIME con fixture

Obiettivo:

riconoscere ricevute e risposte da fixture `.eml` senza casella reale.

Scope:

- parser messaggio;
- estrazione subject, Message-ID, In-Reply-To, References;
- estrazione codice `VC-XXXXXXXX`;
- classificazione ricevute note;
- fallback unclassified.

Risultato verificabile:

- test fixture accettazione, consegna, mancata consegna, risposta normale.

### VC-019B.4 — Provider fake e job processor

Obiettivo:

eseguire un ciclo di polling astratto contro provider fake.

Scope:

- `PollPecMailboxUseCase`;
- checkpoint;
- idempotenza;
- update `OutboundCommunication`;
- transizione report a `Comunicata` solo su consegna.

Risultato verificabile:

- integration test completo senza PEC reale.

### VC-019B.5 — Provider SMTP/IMAP reale dietro feature flag

Obiettivo:

integrare una casella PEC reale in ambiente di test/staging.

Scope:

- invio SMTP;
- polling IMAP;
- configurazione env;
- test manuale con caselle PEC controllate;
- nessun invio automatico non supervisionato in produzione finche non approvato.

Risultato verificabile:

- invio test → ricevuta accettazione → ricevuta consegna → stato `delivered` → report `Comunicata`.

### VC-019B.6 — Backoffice audit

Obiettivo:

mostrare ricevute e messaggi inbound all'admin.

Scope:

- lista ricevute per comunicazione;
- stato classificazione;
- messaggi non classificati;
- nessuna esposizione pubblica.

Risultato verificabile:

- admin vede audit tecnico senza dover aprire la casella PEC.

## Fonti consultate

- Aruba/Pec.it, pagina servizi PEC e prezzi: `https://www.pec.it/`
- Aruba guide, sezione PEC e configurazione client: `https://guide.aruba.it/`
- InfoCert Legalmail, piani e caratteristiche: `https://www.infocert.it/pec`
- Legalmailpec, prezzi/portale e collegamento API: `https://www.legalmailpec.it/`
- Register.it, listino prezzi: `https://www.register.it/company/listino-prezzi/`
- OpenAPI.it, API PEC pricing/endpoints: `https://console.openapi.com/it/apis/pec/pricing`
- AgID, note integrative regole tecniche PEC v12.0: `https://www.agid.gov.it/`
- Trust services AgID, glossario ricevuta avvenuta consegna: `https://trustservices.agid.gov.it/`
- Namirial/Sicurezza Postale, configurazione client e documentazione supporto: `https://www.sicurezzapostale.it/`, `https://servicedesk.namirial.com/`
