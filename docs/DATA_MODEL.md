# Data Model

Modello concettuale. Non è ancora uno schema ORM definitivo.

## Report

- id
- publicCode
- title
- description
- categoryId
- source
- createdByAdminId
- latitude
- longitude
- address
- publicStatus
- moderationStatus
- createdAt
- publishedAt
- communicatedAt
- resolvedAt

Note implementative MVP:

- `source` indica il canale di origine della segnalazione e supporta `platform`, `social`, `email`, `direct`, `other`.
- `source = platform` e il default per le segnalazioni create dal form pubblico `/segnala`.
- le segnalazioni create manualmente da admin devono valorizzare esplicitamente la fonte e nascono comunque `pending_review`, senza pubblicazione automatica.
- la fonte e informazione operativa/admin: non viene richiesta al cittadino e non viene mostrata nelle viste pubbliche MVP.
- `createdByAdminId` e nullable, referenzia `admin_users.id` con `ON DELETE SET NULL` ed e valorizzato solo per segnalazioni create manualmente dal backoffice.
- report creati dal form pubblico hanno `createdByAdminId = null`.
- `createdByAdminId` e dato di audit interno: puo essere mostrato nel dettaglio admin, ma non deve essere esposto nelle viste pubbliche.

## ReportAttachment

- id
- reportId
- type
- storageKey
- mimeType
- size
- createdAt

Note implementative MVP:

- `type` supporta `image`.
- e consentito al massimo un allegato immagine per report.
- `storageKey` resta interno e non deve essere esposto in HTML pubblico o payload pubblici.
- la foto puo essere servita pubblicamente solo se il report e approvato e ha stato pubblico.

## ReportConfirmation

- id
- reportId
- antiAbuseKey
- createdAt

Note implementative MVP:

- `reportId` e FK verso `reports.id` con cancellazione a cascata.
- `antiAbuseKey` e una chiave pseudonima derivata server-side da un cookie first-party anonimo; il valore del cookie non viene salvato nel database.
- esiste un vincolo univoco su `(reportId, antiAbuseKey)` per impedire conferme duplicate banali dallo stesso browser.
- il pubblico vede solo il conteggio aggregato, non chiavi, cookie, IP o timestamp individuali.

## ReportEvent

- id
- reportId
- type
- visibility
- publicStatus
- metadata
- createdAt

Note implementative MVP:

- `visibility` supporta `public` e `internal`. Non e stato introdotto uno stato `system` per VC-014 perche gli eventi tecnici necessari sono rappresentabili come eventi interni.
- solo eventi con `visibility = public` possono alimentare la timeline pubblica. Il filtro deve avvenire lato server.
- `ReportCreated` resta interno: la timeline pubblica inizia dalla pubblicazione/approvazione della segnalazione.
- `ReportRejected` resta interno e non deve comparire in viste pubbliche.
- `createdAt` e `id` definiscono l'ordinamento stabile della timeline: `createdAt ASC`, poi `id ASC`.
- `metadata` puo contenere dati operativi interni legati all'evento. Di default i metadata sono considerati non pubblici.
- In VC-006 la nota opzionale di rifiuto viene salvata come `metadata.internalNote` sull'evento interno `ReportRejected`.
- Chiavi metadata previste: `source`, `createdByAdminId`, `recipientName`, `recipientOrganization`, `recipientAddress`, `communicationChannel`, `externalMessageId`, `internalNote`.
- Le note salvate negli eventi interni non devono essere esposte nelle viste pubbliche.
- In VC-015 gli eventi `CommunicationRecorded`, `CommunicationSent`, `CommunicationDelivered` e `CommunicationFailed` sono interni. L'unico evento pubblico collegato alla comunicazione resta `ReportCommunicated`.
- Eventi futuri previsti ma non implementati: `ReplyReceived`, `ReminderSent`. La loro introduzione richiedera aggiornamento enum e migration.

## Category

- id
- name
- slug
- active
- createdAt
- updatedAt

Note implementative MVP:

- `slug` e univoco e normalizzato in formato URL-safe.
- `active = false` nasconde la categoria dal form di nuova segnalazione.
- non e previsto hard delete dal backoffice: i report storici mantengono la FK verso `categories.id`.
- cambiare lo slug non rompe i report esistenti perche i report non usano lo slug come FK.
- le categorie definitive e la loro matrice con enti/destinatari restano decisioni aperte.

## Recipient

- id
- name
- organization
- email
- pec
- active
- createdAt
- updatedAt

Note implementative MVP:

- `name` e `organization` sono obbligatori.
- almeno uno tra `email` e `pec` deve essere presente.
- email e PEC vengono validate solo sintatticamente e normalizzate lowercase; non viene certificato che un indirizzo sia realmente PEC.
- `email` e `pec` sono univoche quando valorizzate, per evitare duplicati operativi banali nel backoffice.
- `active = false` mantiene il destinatario nella configurazione, ma lo esclude dalle proposte operative di smistamento.

## CategoryRecipient

- categoryId
- recipientId
- sortOrder
- createdAt
- updatedAt

Note implementative MVP:

- relazione many-to-many tra categorie e destinatari.
- la coppia `(categoryId, recipientId)` e univoca.
- `sortOrder = 0` indica il destinatario principale/preferenziale per la categoria.
- categorie o destinatari disattivati non cancellano automaticamente le associazioni.
- non esiste una colonna PEC su `categories`: gli indirizzi email/PEC restano su `recipients` e vengono collegati tramite questa matrice.

## AdminUser

- id
- email
- passwordHash
- role
- active
- createdAt
- updatedAt

Note implementative MVP:

- `email` e normalizzata in lowercase e deve essere univoca.
- `passwordHash` contiene solo hash Argon2id, mai password in chiaro.
- `role` al momento supporta solo `admin`; ruoli granulari sono fuori scope.
- Gli admin sono usati solo per il backoffice. I cittadini restano senza account.

## OutboundCommunication

- id
- reportId
- recipientId
- recipientNameSnapshot
- recipientOrganizationSnapshot
- recipientAddressSnapshot
- channel
- subject
- body
- status
- createdAt
- sentAt
- deliveredAt
- failedAt
- externalMessageId

Note implementative MVP:

- `channel` supporta `email` e `pec` solo come informazione storica; non viene effettuato invio reale.
- `status` supporta `draft`, `sent`, `delivered`, `failed`.
- `recipientId` mantiene il riferimento configurativo quando disponibile; gli snapshot preservano lo storico se il destinatario viene modificato o disattivato.
- una comunicazione `sent` non cambia lo stato pubblico del report.
- solo `delivered` puo portare il report da `Segnalata` a `Comunicata`, passando dal dominio `Report`.
- `failed` non cambia lo stato del report e resta informazione interna admin.
- subject, body, destinatario, indirizzi, externalMessageId e dettagli tecnici non devono comparire nella scheda pubblica.

## NewsPost

- id
- title
- slug
- excerpt
- featuredImageUrl
- featuredImageAlt
- content
- contentJson
- status
- publishedAt
- createdAt
- updatedAt

Note implementative MVP:

- `status` supporta solo `draft` e `published`.
- `slug` e URL-safe, lowercase e univoco. Puo essere generato dal titolo e modificato dall'admin.
- `contentJson` e la fonte primaria del contenuto editoriale: un documento Tiptap salvato come JSONB e validato server-side.
- `content` resta valorizzato come testo derivato dal documento per compatibilita legacy e usi semplici di lettura/ricerca; non e la fonte primaria.
- la migration VC-017B converte i contenuti testuali esistenti in un documento Tiptap con paragrafi semplici, senza perdita del testo gia salvato.
- non viene salvato HTML raw; il rendering pubblico usa un renderer React basato sui nodi consentiti.
- `featuredImageUrl` e opzionale e, per l'MVP, usa percorsi locali versionati sotto `public/`; non introduce upload o storage esterno per le news.
- se `featuredImageUrl` e valorizzato, `featuredImageAlt` e obbligatorio per accessibilita.
- `publishedAt` rappresenta la prima pubblicazione: quando una notizia torna bozza non viene cancellato.
- le query pubbliche restituiscono solo notizie `published` con `publishedAt` valorizzato, ordinate per `publishedAt DESC`.

## InboundCommunication

- id
- reportId
- externalMessageId
- sender
- subject
- body
- receivedAt

## Note

- id
- reportId
- authorAdminId
- body
- createdAt

## Metriche operative — VC-021

Le metriche operative non introducono nuove tabelle: sono viste aggregate derivate dai dati gia presenti in `reports`, `categories` e `report_confirmations`.

### Definizioni

- **Segnalazioni ricevute**: tutte le righe di `reports`, indipendentemente dalla moderazione. Timestamp di riferimento: `reports.createdAt`.
- **Da verificare**: report con `moderationStatus = pending_review`.
- **Pubblicate**: report con `moderationStatus = approved`, `publicStatus` valorizzato e `publishedAt` valorizzato. Timestamp di riferimento: `reports.publishedAt`.
- **Comunicate**: report con `publicStatus = communicated` oppure `publicStatus = resolved`. Un report risolto e considerato anche gia comunicato, per non sottostimare le comunicazioni storiche. Timestamp di riferimento: `reports.communicatedAt`.
- **Risolte**: report con `publicStatus = resolved`. Timestamp di riferimento: `reports.resolvedAt`.
- **Rifiutate**: report con `moderationStatus = rejected`.
- **Conferme totali**: numero totale di righe in `report_confirmations`.
- **Tasso di risoluzione**: `segnalazioni risolte / segnalazioni pubblicate`, espresso in percentuale. Se non esistono segnalazioni pubblicate, il valore e `Non disponibile` e non viene calcolata alcuna divisione.
- **Tempo mediano di risoluzione**: mediana della durata `resolvedAt - publishedAt` per report risolti.
- **Tempo mediano di comunicazione**: mediana della durata `communicatedAt - publishedAt` per report comunicati o risolti.
- **Distribuzione per categoria**: per ogni categoria con almeno una segnalazione pubblicata o risolta, conteggio di pubblicate e risolte.
- **Andamento ultimi 6 mesi**: serie mensile con segnalazioni ricevute aggregate per `createdAt` e segnalazioni risolte aggregate per `resolvedAt`.

### Privacy

Le metriche pubbliche predisposte espongono solo aggregati: pubblicate, comunicate, risolte, conferme totali e tasso di risoluzione. Non espongono ID interni, chiavi anti-abuso, dati admin, destinatari, dati PEC, note interne o dati individuali di report pending/rejected.
