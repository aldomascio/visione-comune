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

- `metadata` puo contenere dati operativi interni legati all'evento.
- In VC-006 la nota opzionale di rifiuto viene salvata come `metadata.internalNote` sull'evento interno `ReportRejected`.
- Le note salvate negli eventi interni non devono essere esposte nelle future viste pubbliche.

## Category

- id
- name
- slug
- active

## Recipient

- id
- name
- organization
- email
- pec
- active

## CategoryRecipient

- id
- categoryId
- recipientId
- priority / order

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
- channel
- subject
- status
- externalMessageId
- sentAt
- deliveredAt

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
