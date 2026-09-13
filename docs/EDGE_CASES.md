# Edge Cases

## EC-001 — Codice perso
Non essendoci account o email, il codice non è recuperabile tramite identità.

Comportamento:
- avvisare chiaramente l'utente;
- pulsante "Copia codice";
- valutare ricevuta scaricabile o salvabile.

## EC-002 — Duplicato molto simile
Se esiste una segnalazione simile, mostrarla prima della creazione. In VC-010 vengono mostrati solo report approvati e pubblici entro la soglia configurata.

## EC-003 — Problema diverso ma geograficamente vicino
La vicinanza geografica da sola non basta per definire un duplicato: in VC-010 servono almeno stessa categoria, vicinanza geografica e recenza. L'utente puo comunque dichiarare che il problema e diverso e continuare.

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

## VC-007 — Tracking pubblico

### EC-VC007-001 — Codice valido ma segnalazione non ancora approvata

Caso:
il cittadino usa il codice di una segnalazione ancora `Da verificare`.

Gestione prevista:
il tracking conferma che la segnalazione e stata ricevuta e che e in verifica, ma non mostra titolo, descrizione, posizione o pagina pubblica completa.

### EC-VC007-002 — Codice valido ma segnalazione rifiutata

Caso:
il cittadino usa il codice di una segnalazione rifiutata.

Gestione prevista:
il tracking mostra un messaggio generico di mancata pubblicazione. Note interne, motivazioni operative ed eventi interni non sono esposti.

### EC-VC007-003 — Accesso diretto a dettaglio non pubblico

Caso:
qualcuno prova ad aprire direttamente `/segnalazioni/[publicCode]` per una segnalazione pending o rejected.

Gestione prevista:
la pagina pubblica non viene renderizzata. Solo segnalazioni approvate con stato pubblico sono accessibili come dettaglio pubblico.


## VC-008 — Mappa pubblica

### EC-VC008-001 — Segnalazioni non pubbliche sulla mappa

Caso:
una segnalazione `pending_review` o `rejected` ha coordinate valide nel database.

Gestione prevista:
la query della mappa filtra a livello database solo segnalazioni `approved` con stato pubblico e data di pubblicazione. Titolo, descrizione, posizione e note interne di report non pubblici non vengono restituiti alla UI.

### EC-VC008-002 — Mappa non caricabile o provider tile indisponibile

Caso:
MapLibre o lo style URL non riescono a caricare la mappa.

Gestione prevista:
la pagina resta utilizzabile tramite lista accessibile delle segnalazioni pubbliche visibili. Il provider tile definitivo resta configurabile e da deliberare per la produzione.

### EC-VC008-003 — Nessuna segnalazione pubblica

Caso:
non esistono segnalazioni approvate, oppure i filtri non hanno risultati.

Gestione prevista:
la pagina mostra la mappa centrata su Venafro e un empty state comprensibile, senza errori tecnici.


## VC-009 — Upload immagini moderabile

### EC-VC009-001 — Foto valida ma report non creato

Caso:
la foto viene salvata su filesystem locale, ma il salvataggio del report o dell'attachment fallisce.

Gestione prevista:
il use case esegue cleanup compensativo del file appena salvato. Il limite e documentato: database e filesystem non sono una singola transazione atomica.

### EC-VC009-002 — Accesso diretto a foto non pubblica

Caso:
un utente conosce o prova a indovinare la URL pubblica della foto di una segnalazione pending o rejected.

Gestione prevista:
la route pubblica restituisce 404 finche il report non e approvato e pubblico. Lo storage key e il path filesystem non vengono esposti.

### EC-VC009-003 — File non immagine o corrotto

Caso:
il cittadino carica un file con estensione o MIME ingannevole, vuoto, corrotto o non supportato.

Gestione prevista:
la validazione server-side controlla dimensione, signature/magic bytes e processamento immagine. Il form mostra un errore comprensibile e il report non viene creato con attachment incoerente.

## VC-010 — Rilevamento duplicati iniziale

### EC-VC010-001 — Possibile duplicato non pubblico

Caso:
esiste una segnalazione pending o rejected molto vicina alla nuova segnalazione.

Gestione prevista:
non viene mostrata nel controllo duplicati pubblico. Il cittadino vede solo dati gia pubblici di report approvati.

### EC-VC010-002 — Falso positivo vicino

Caso:
una segnalazione pubblica nella stessa categoria e molto vicina, ma il problema dell'utente e diverso.

Gestione prevista:
il sistema mostra il candidato, ma non blocca la creazione. L'utente puo usare `Il mio problema e diverso, continua`.

### EC-VC010-003 — Foto selezionata prima del controllo duplicati

Caso:
l'utente seleziona una foto e il controllo duplicati mostra uno step intermedio prima della creazione.

Gestione prevista:
la foto non viene usata per la deduplica. Poiche il browser non conserva in modo affidabile il file input dopo il roundtrip della Server Action, la UI avvisa di riselezionare la foto se l'utente decide di continuare creando una nuova segnalazione.

### EC-VC010-004 — Report simile oltre soglia o fuori finestra

Caso:
esiste un report nella stessa categoria, ma oltre 100 metri o pubblicato prima della finestra di 90 giorni.

Gestione prevista:
non viene mostrato in VC-010. Le soglie restano configurabili per evoluzioni successive.
