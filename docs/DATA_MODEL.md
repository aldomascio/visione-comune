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
- createdAt

## ReportConfirmation

- id
- reportId
- antiAbuseKey / fingerprint strategy
- createdAt

## ReportEvent

- id
- reportId
- type
- visibility
- publicStatus
- metadata
- createdAt

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
- authProviderId
- role
- active

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
