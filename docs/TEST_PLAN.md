# Test Plan

## Obiettivo

Ridurre regressioni e bug da iterazioni successive.

## Segnalazione

### T-001
Given un visitatore non autenticato  
When compila correttamente il form  
Then viene creata una segnalazione  
And viene generato un codice univoco  
And non è pubblica.

### T-002
Given una segnalazione non approvata  
Then non deve comparire sulla mappa.

### T-003
Given una segnalazione simile  
When l'utente prova a crearne una nuova  
Then il sistema mostra il possibile duplicato.

### T-004
Given un possibile duplicato  
When l'utente indica che il problema è diverso  
Then può proseguire.

## Moderazione

### T-005
Given una segnalazione da verificare  
When un admin la approva  
Then diventa pubblica  
And stato pubblico = Segnalata.

### T-006
Given una segnalazione rifiutata  
Then non compare pubblicamente.

## Comunicazione

### T-007
Given una segnalazione approvata  
When la PEC viene consegnata  
Then stato = Comunicata.

### T-008
Given una PEC non consegnata  
Then lo stato non passa a Comunicata.

## Risoluzione

### T-009
Given una segnalazione Comunicata  
When un admin verifica la risoluzione  
Then stato = Risolta.

## Conferme

### T-010
Given una segnalazione pubblica  
When un cittadino la conferma  
Then il conteggio aumenta.

## Regressioni

Ogni bug corretto deve generare, quando pratico, un test di regressione.
