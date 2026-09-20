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
### BR-021
Ogni segnalazione deve essere verificata e approvata manualmente da Visione Comune prima della pubblicazione, anche se supera controlli automatici, arriva da un canale conosciuto o viene creata manualmente da un amministratore.

### BR-022
I controlli automatici possono bloccare o chiedere correzioni solo per problemi oggettivi precedenti alla moderazione, come contenuti tecnicamente invalidi, spam evidente, file non validi o duplicati evidenti secondo regole definite. Non devono sostituire la valutazione umana sulla validita sostanziale della segnalazione.

### BR-023
La piattaforma deve evitare di generare un volume eccessivo di PEC/email verso Comune o altri enti, mantenendo tracciabilita delle singole segnalazioni e aggregando le comunicazioni quando opportuno.


### BR-024
Una segnalazione identificata come duplicata dopo la creazione non deve essere cancellata o fusa fisicamente: mantiene codice pubblico, fonte, allegati, storico e conferme gia ricevute, ma viene collegata a una segnalazione principale.

### BR-025
Una segnalazione duplicata non raccoglie nuove conferme e non compare come problema autonomo nella mappa pubblica o nelle liste aggregate principali. La scheda diretta resta raggiungibile e rimanda alla segnalazione principale.

### BR-026
Una foto allegata non e pubblicabile solo perche esiste nello storage: deve appartenere a una segnalazione approvata/pubblica e avere review status `approved`.

### BR-027
La foto di risoluzione e opzionale: una segnalazione puo diventare `Risolta` anche senza foto.

### BR-028
La foto di risoluzione puo essere caricata solo da un amministratore su segnalazioni gia `Comunicata` o `Risolta`; nasce `pending_review` e richiede approvazione esplicita prima della pubblicazione.

### BR-029
Il detector automatico privacy per volti, targhe o dati identificativi nelle immagini non e implementato nell'MVP corrente e resta una misura P1 futura.

### BR-030
Una trasmissione operativa verso un destinatario puo contenere una o piu segnalazioni, evitando di imporre una PEC/email separata per ogni singola segnalazione.

### BR-031
Una trasmissione puo includere operativamente solo segnalazioni gia approvate, pubbliche, non duplicate e coerenti con il destinatario configurato nella matrice categoria → destinatario.

### BR-032
La creazione di una bozza o la marcatura come `Inviata` non cambia lo stato pubblico delle segnalazioni incluse. Solo la marcatura come `Consegnata` puo portare le segnalazioni eleggibili da `Segnalata` a `Comunicata`.

### BR-033
Le regole future di aggregazione, frequenza, soglia e sollecito delle trasmissioni devono restare configurabili e non sono hardcoded nell'MVP corrente.
# Regole delle proposte

- **BR-P01** — Una proposta è privata e separata da una segnalazione.
- **BR-P02** — L'invio anonimo non conserva dati di contatto.
- **BR-P03** — L'invio con contatto richiede un'email valida, usata solo per la proposta.
- **BR-P04** — Gli stati Nuova, Da approfondire e Archiviata sono esclusivamente interni.
- **BR-P05** — L'invio richiede la presa visione esplicita dell'informativa privacy; non costituisce consenso marketing o iscrizione alla newsletter.
