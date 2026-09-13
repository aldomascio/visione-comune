# Edge Cases

## EC-001 — Codice perso
Non essendoci account o email, il codice non è recuperabile tramite identità.

Comportamento:
- avvisare chiaramente l'utente;
- pulsante "Copia codice";
- valutare ricevuta scaricabile o salvabile.

## EC-002 — Duplicato molto simile
Se esiste una segnalazione simile, mostrarla prima della creazione.

## EC-003 — Problema diverso ma geograficamente vicino
La vicinanza geografica da sola non basta per definire un duplicato.

## EC-004 — Foto troppo grande
- validare formato;
- ridimensionare/comprimere;
- imporre un limite massimo.

## EC-005 — PEC inviata ma non consegnata
La segnalazione resta `Segnalata`.

## EC-006 — PEC consegnata ma nessuna risposta
Lo stato diventa `Comunicata`, non "Presa in carico".

## EC-007 — Segnalazione con dati personali nel testo
La moderazione deve poter modificare o rifiutare prima della pubblicazione.

## EC-008 — Emergenza
Mostrare indicazione che la piattaforma non sostituisce i servizi di emergenza.

## EC-009 — Categoria errata
L'amministratore deve poter correggere la categoria senza perdere la cronologia.

## EC-010 — Foto non pertinente o offensiva
La segnalazione non deve essere pubblicata finché non viene moderata.

## EC-011 — Conferme multiple artificiali
Prevedere una strategia anti-abuso compatibile con l'assenza di account.

## EC-012 — Destinatario non noto
La segnalazione può restare approvata e pubblica anche se lo smistamento non è ancora definito.

## EC-013 — Ente risponde con allegati
Gli allegati devono poter essere collegati internamente alla segnalazione.

## EC-014 — Segnalazione risolta e poi ricompare
Da valutare se riaprire la stessa segnalazione o crearne una nuova. Decisione ancora aperta.

## EC-015 — Indirizzo ambiguo
La posizione sulla mappa deve prevalere sul solo testo dell'indirizzo quando disponibile.
