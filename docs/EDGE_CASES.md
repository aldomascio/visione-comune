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

## VC-004 — Creazione segnalazione

### EC-VC004-001 — Geolocalizzazione negata o non disponibile

Caso:
l'utente clicca `Usa la mia posizione`, ma nega il permesso oppure il browser non supporta la Geolocation API.

Gestione prevista:
il form mostra un messaggio comprensibile e resta utilizzabile con inserimento manuale delle coordinate. L'indirizzo resta un campo testuale.

### EC-VC004-002 — Indirizzo senza coordinate

Caso:
l'utente inserisce solo un indirizzo testuale senza usare geolocalizzazione.

Gestione prevista:
in VC-004 il sistema non effettua geocoding; le coordinate restano richieste tramite fallback temporaneo. La conversione indirizzo-coordinate sara gestita in una task successiva.

### EC-VC004-003 — Categoria non disponibile

Caso:
la categoria selezionata non esiste piu o e stata disattivata tra rendering del form e invio.

Gestione prevista:
la Server Action rifiuta l'invio con messaggio utente sulla categoria disponibile, senza esporre dettagli database.

### EC-VC004-004 — Collisione codice pubblico

Caso:
il generatore produce un codice pubblico gia presente nel database.

Gestione prevista:
il layer applicativo ritenta la generazione fino a un limite esplicito. Se il limite viene esaurito, l'utente riceve un errore controllato e non dettagli tecnici.

## VC-006 — Moderazione amministratori

### EC-VC006-001 — Doppia moderazione concorrente

Caso:
due amministratori aprono la stessa segnalazione ancora `Da verificare` e tentano di approvarla o rifiutarla quasi nello stesso momento.

Gestione prevista:
il dominio impedisce transizioni incoerenti su segnalazioni gia moderate. Il repository salva la moderazione solo se lo stato precedente nel database e ancora `pending_review`; se lo stato e cambiato, l'azione fallisce con messaggio controllato e l'admin deve aggiornare la pagina.

### EC-VC006-002 — Nota interna di rifiuto

Caso:
un amministratore rifiuta una segnalazione e vuole lasciare un motivo operativo sintetico.

Gestione prevista:
la nota e opzionale, interna, non pubblica, e viene salvata nei metadata dell'evento `ReportRejected`. Non introduce un sistema di commenti o note generiche.
