# Agent Instructions

Prima di modificare il codice:

1. Leggi `PROJECT_CONTEXT.md`.
2. Leggi `PRODUCT.md`.
3. Leggi `BUSINESS_RULES.md`.
4. Leggi le sezioni rilevanti di `USER_FLOWS.md`.
5. Controlla `EDGE_CASES.md`.
6. Controlla `DECISIONS.md`.
7. Se la task riguarda dati o architettura, leggi anche `DATA_MODEL.md` e `ARCHITECTURE.md`.

## Regole

- Non cambiare il comportamento del prodotto se non richiesto.
- Non inventare requisiti.
- Non rimuovere validazioni per semplificare l'implementazione.
- Non modificare lo schema dati senza aggiornare `DATA_MODEL.md`.
- Non introdurre dipendenze senza spiegare perché servono.
- Non cambiare gli stati pubblici senza aggiornare `BUSINESS_RULES.md` e `DECISIONS.md`.
- Ogni bug fix dovrebbe includere un regression test quando pratico.
- Ogni nuovo edge case rilevante va aggiunto a `EDGE_CASES.md`.
- Mantieni separati dominio e integrazioni esterne.
- Preferisci codice esplicito a astrazioni premature.
- Non cambiare silenziosamente UX flow esistenti.
- Se una decisione non è definita, fermati a una proposta e documenta l'incertezza.

## Contenuti e stile dell'interfaccia

- Non inventare mai contenuti, dati, testi, immagini o informazioni placeholder. Mostra esclusivamente informazioni realmente disponibili nel prodotto, nel database o nella documentazione approvata. Quando un dato manca, usa uno stato vuoto coerente invece di sostituirlo con contenuto fittizio.
- Non aggiungere dati demo, valori di esempio o fallback presentati come informazioni reali, salvo richiesta esplicita dell'utente.
- Non hardcodare stili nei componenti. Usa sempre token del tema, primitive del design system e classi condivise già disponibili.
- Non usare attributi `style`, colori letterali, misure arbitrarie o CSS inline, salvo richiesta esplicita dell'utente o necessità tecnica documentata che non possa essere espressa attraverso il design system.
- Se uno stile ricorre o rappresenta una variante di un componente, centralizzalo nel componente o nella relativa configurazione invece di duplicarlo nei punti di utilizzo.
- Un'eccezione a queste regole è consentita solo quando l'utente la richiede esplicitamente per la modifica corrente.

## Prima di chiudere una task

Esegui, se disponibili:

- typecheck
- lint
- unit tests
- integration tests
- build

Riporta:

- file modificati;
- comportamento modificato;
- test aggiunti;
- rischi o punti aperti.

## Workflow bug

1. Riproduci il bug.
2. Aggiungi un test che fallisce.
3. Documenta l'edge case se nuovo.
4. Correggi.
5. Verifica i test.
6. Aggiorna documentazione se necessario.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
