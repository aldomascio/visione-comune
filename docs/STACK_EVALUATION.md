# Stack Evaluation

## Obiettivo

Scegliere uno stack semplice da sviluppare in locale, compatibile con vibe coding / agentic coding, economico in fase iniziale e abbastanza modulare da crescere senza riscrivere il progetto.

## Vincoli già noti

- sviluppo locale semplice;
- repository GitHub;
- deploy iniziale possibile su VPS già disponibile;
- costi iniziali minimi;
- database relazionale preferibile;
- upload immagini;
- backoffice;
- mappa;
- integrazione futura PEC;
- integrazione futura newsletter;
- eventuale AI;
- test automatici;
- manutenzione semplice;
- niente dipendenza obbligatoria da un singolo provider serverless.

## Candidati da valutare

L'agente può proporre stack, ma deve confrontare almeno:

- Next.js full-stack su VPS;
- frontend Next.js + backend separato;
- Postgres gestito vs Postgres sul VPS;
- Supabase come servizio opzionale;
- storage locale/object storage;
- ORM/query layer;
- sistema auth solo admin;
- soluzione mappe;
- testing unit/integration/e2e.

## Output richiesto all'agente

Prima di generare codice applicativo, produrre un documento di planning con:

1. stack proposto;
2. alternative scartate;
3. motivazioni;
4. impatto sui costi;
5. impatto sul deploy VPS;
6. rischi;
7. struttura repository;
8. strategia database;
9. strategia storage;
10. strategia auth;
11. strategia test;
12. strategia integrazione PEC futura.

## Regola

La proposta dello stack non è automaticamente approvata.

Deve essere revisionata e deliberata prima di iniziare l'implementazione del core.
