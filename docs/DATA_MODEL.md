# Data Model

Modello concettuale. Non è ancora uno schema ORM definitivo.

## Report

- id
- publicCode
- title
- description
- categoryId
- latitude
- longitude
- address
- publicStatus
- moderationStatus
- createdAt
- publishedAt
- communicatedAt
- resolvedAt

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
- Chiavi metadata previste per evoluzioni future: `recipientName`, `recipientOrganization`, `recipientAddress`, `communicationChannel`, `externalMessageId`, `internalNote`.
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
