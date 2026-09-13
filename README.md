# Visione Comune

Repository del progetto digitale di Visione Comune.

## Obiettivo

Costruire un ecosistema digitale unico per sito, piattaforma di segnalazione, mappa, backoffice, newsletter e comunicazione con gli enti.

## Documentazione

- `PROJECT_CONTEXT.md` → contesto generale del progetto
- `PRODUCT.md` → perimetro funzionale e MVP
- `BUSINESS_RULES.md` → regole di prodotto da non violare
- `USER_FLOWS.md` → flussi principali
- `EDGE_CASES.md` → casi limite noti
- `DATA_MODEL.md` → modello dati concettuale
- `ARCHITECTURE.md` → principi architetturali
- `TEST_PLAN.md` → scenari di test
- `DECISIONS.md` → decisioni prese
- `DESIGN.md` → principi UX/UI
- `AGENTS.md` → istruzioni per agenti di coding
- `STACK_EVALUATION.md` → criteri per scegliere lo stack

## Stato

Il progetto è in fase di predisposizione tecnica. Alcune decisioni implementative sono ancora da definire, in particolare PEC, provider newsletter, infrastruttura definitiva e servizi AI.

## Sviluppo locale

Requisiti:

- Node.js 24 LTS
- pnpm 12

Comandi principali:

```bash
pnpm install
pnpm dev
```

Verifiche:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Il bootstrap non configura ancora database, storage, PEC, AI, newsletter o Docker.
