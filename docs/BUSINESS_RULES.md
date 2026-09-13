# Business Rules

## Regole invarianti

### BR-001
Un cittadino può creare una segnalazione senza account.

### BR-002
Non devono essere richiesti nome, cognome, email o telefono per inviare una segnalazione.

### BR-003
Ogni segnalazione riceve un codice pubblico univoco.

### BR-004
Una nuova segnalazione non è immediatamente pubblica.

### BR-005
Una segnalazione deve essere approvata da un amministratore prima della pubblicazione.

### BR-006
Gli stati pubblici sono:
- Segnalata
- Comunicata
- Risolta

### BR-007
"Comunicata" significa che la comunicazione all'ente competente risulta correttamente consegnata.

### BR-008
La consegna della PEC non equivale a presa in carico.

### BR-009
"Risolta" richiede verifica di Visione Comune.

### BR-010
Un cittadino non può commentare una segnalazione.

### BR-011
Un cittadino non può aggiungere fotografie a una segnalazione esistente.

### BR-012
Un cittadino può confermare una segnalazione esistente.

### BR-013
Prima della creazione devono essere cercate possibili segnalazioni duplicate.

### BR-014
Il rilevamento duplicati non può bloccare in modo assoluto la creazione se l'utente dichiara che il problema è diverso.

### BR-015
Nella prima versione l'AI può suggerire, ma non deve prendere decisioni autonome irreversibili sull'invio agli enti.

### BR-016
Le segnalazioni di emergenza non devono essere gestite come normali ticket civici.

### BR-017
Una segnalazione non approvata non deve comparire sulla mappa pubblica.

### BR-018
La scheda pubblica deve mostrare lo storico rilevante della segnalazione.

### BR-019
Le integrazioni esterne devono poter essere sostituite senza riscrivere il core del dominio.

### BR-020
Il sistema deve essere progettato per partire con infrastruttura minima e scalare successivamente.
