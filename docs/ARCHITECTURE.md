# Architecture

## Principi

- modularità;
- separazione tra dominio e integrazioni esterne;
- backend con validazione server-side;
- nessuna logica critica affidata solo al client;
- provider esterni sostituibili;
- infrastruttura minima in fase iniziale;
- testabilità;
- osservabilità sufficiente a diagnosticare errori.

## Moduli suggeriti

- reports
- moderation
- map
- confirmations
- categories
- recipients
- communications
- pec
- newsletter
- admin
- auth
- storage
- analytics

## Layer concettuali

`UI → application services → domain logic → repositories/adapters → database/external providers`

## Integrazioni

Le integrazioni esterne devono passare attraverso adapter dedicati.

Esempi:

- `PecProvider`
- `NewsletterProvider`
- `StorageProvider`
- `AiProvider`

Il core non deve dipendere direttamente da un singolo vendor.

## Regola

Non introdurre astrazioni generiche senza un bisogno concreto. Preferire confini chiari e codice esplicito.
