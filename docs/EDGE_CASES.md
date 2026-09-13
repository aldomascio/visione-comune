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

## VC-011 — Conferme segnalazione

### EC-VC011-001 — Doppio click o invio ripetuto

Caso:
il cittadino clicca piu volte `Conferma anche tu` dalla stessa sessione/browser.

Gestione prevista:
il vincolo univoco su report e chiave anti-abuso impedisce duplicati. Il conteggio resta invariato e la UI mostra che la segnalazione e gia stata confermata.

### EC-VC011-002 — Cookie assente o cancellato

Caso:
il cittadino non ha ancora il cookie tecnico anonimo oppure lo ha cancellato.

Gestione prevista:
la Server Action crea un nuovo cookie first-party HttpOnly e usa una chiave derivata per registrare la conferma. Questo protegge dai duplicati banali ma non identifica stabilmente la persona.

### EC-VC011-003 — Conferma su report non pubblico

Caso:
un client prova a confermare una segnalazione pending, rejected, inesistente o non pubblicabile.

Gestione prevista:
il use case rilegge il report tramite `publicCode` e accetta solo report approvati con stato pubblico. Non usa ID interni forniti dal client.

### EC-VC011-004 — Privacy conferme

Caso:
un cittadino consulta la scheda pubblica con conteggio conferme.

Gestione prevista:
la pagina mostra solo il conteggio aggregato. Non espone cookie, chiave anti-abuso, IP, timestamp individuali o metadati tecnici.

## VC-012 — Gestione categorie

### EC-VC012-001 — Categoria disattivata con report storici

Caso:
un admin disattiva una categoria gia usata da report approvati o da report in moderazione.

Gestione prevista:
la categoria non compare piu nel form `/segnala` e non puo essere usata per nuove segnalazioni. I report storici continuano a mostrare il nome categoria nelle viste admin, nella scheda pubblica, nella mappa e nei flussi che leggono dati pubblici.

### EC-VC012-002 — Slug duplicato o non valido

Caso:
un admin crea o modifica una categoria usando uno slug gia esistente, vuoto o non URL-safe.

Gestione prevista:
la validazione server-side normalizza lo slug e rifiuta duplicati o valori invalidi con errore sul campo. Il vincolo univoco database resta la protezione finale contro condizioni concorrenti.

### EC-VC012-003 — Cambio slug di una categoria esistente

Caso:
un admin modifica lo slug di una categoria gia usata.

Gestione prevista:
il cambio e consentito perche i report referenziano `categoryId`, non lo slug. Le URL pubbliche dei report e la mappa non dipendono dallo slug categoria.

### EC-VC012-004 — Creazione report con categoria disattivata via richiesta manuale

Caso:
un client invia manualmente a `/segnala` l'ID di una categoria disattivata.

Gestione prevista:
il use case di creazione rilegge la categoria tramite repository e accetta solo `findActiveById`. La richiesta viene rifiutata come categoria non valida.

## VC-013 — Destinatari e matrice di smistamento

### EC-VC013-001 — Categoria senza destinatari

Caso:
un admin apre il dettaglio di una segnalazione la cui categoria non ha destinatari associati.

Gestione prevista:
il backoffice mostra `Nessun destinatario configurato per questa categoria.` e non propone invii o automatismi.

### EC-VC013-002 — Destinatario disattivato ma ancora associato

Caso:
un destinatario associato a una categoria viene disattivato.

Gestione prevista:
la relazione resta visibile nella matrice, ma il destinatario non viene proposto come operativo nel dettaglio segnalazione.

### EC-VC013-003 — Categoria disattivata con matrice esistente

Caso:
una categoria viene disattivata dopo aver configurato destinatari.

Gestione prevista:
la matrice non viene cancellata. La categoria resta visibile in admin, ma non e usabile per nuove segnalazioni.

### EC-VC013-004 — Duplicato email o PEC

Caso:
un admin prova a creare o modificare un destinatario usando una email o PEC gia presente.

Gestione prevista:
la validazione applicativa e il vincolo database rifiutano il duplicato con errore sul campo.

## VC-014 — Timeline completa

### EC-VC014-001 — Evento interno nella scheda pubblica

Caso:
un evento contiene note interne, metadata tecnici o informazioni operative non adatte alla pubblicazione.

Gestione prevista:
la timeline pubblica legge solo eventi con `visibility = public` e il use case pubblico restituisce solo label, descrizione e data. Metadata, note interne, ID destinatari e dettagli tecnici non vengono esposti.

### EC-VC014-002 — Eventi con stesso timestamp

Caso:
due eventi della stessa segnalazione hanno lo stesso `createdAt`.

Gestione prevista:
l'ordinamento resta stabile usando `createdAt ASC` e poi `id ASC`.

### EC-VC014-003 — Segnalazione rifiutata con nota interna

Caso:
un admin rifiuta una segnalazione inserendo una nota interna.

Gestione prevista:
il backoffice mostra `ReportRejected` e la nota nella timeline admin. La route pubblica della segnalazione non viene renderizzata e il tracking mostra solo il messaggio generico di mancata pubblicazione.

### EC-VC014-004 — Metadata non riconosciuti

Caso:
un evento contiene chiavi metadata non ancora mappate dalla presentazione della timeline.

Gestione prevista:
la vista admin mostra solo metadata conosciuti e utili. La vista pubblica non espone metadata. Non viene mostrato JSON grezzo.

## VC-015 — Comunicazioni manuali

### EC-VC015-001 — Comunicazione registrata ma non consegnata

Caso:
un admin registra una comunicazione come `sent`, ma non ne conferma la consegna.

Gestione prevista:
la comunicazione resta visibile solo in admin e il report resta nello stato pubblico `Segnalata`.

### EC-VC015-002 — Comunicazione fallita

Caso:
un admin marca una comunicazione come `failed`.

Gestione prevista:
viene registrato un evento interno `CommunicationFailed`, `failedAt` viene valorizzato e lo stato pubblico del report non cambia.

### EC-VC015-003 — Doppio click su consegnata

Caso:
un admin prova a marcare come consegnata una comunicazione gia `delivered`.

Gestione prevista:
il use case restituisce lo stato gia consegnato senza generare un secondo evento `ReportCommunicated`.

### EC-VC015-004 — Seconda comunicazione consegnata su report gia Comunicata

Caso:
un report e gia nello stato `Comunicata` e una seconda comunicazione viene marcata `delivered`.

Gestione prevista:
la comunicazione viene aggiornata e resta tracciata in admin, ma non viene duplicato l'evento pubblico `ReportCommunicated`.

### EC-VC015-005 — Destinatario modificato dopo comunicazione

Caso:
il nome, l'organizzazione o l'indirizzo del destinatario vengono modificati dopo la registrazione della comunicazione.

Gestione prevista:
lo storico comunicazione continua a mostrare `recipientNameSnapshot`, `recipientOrganizationSnapshot` e `recipientAddressSnapshot` originali.

### EC-VC015-006 — Dettagli comunicazione nella scheda pubblica

Caso:
il cittadino apre la pagina pubblica dopo la consegna confermata.

Gestione prevista:
vede solo stato `Comunicata` e testo timeline pubblico generico. Non vede PEC, email, destinatario, oggetto, corpo, externalMessageId o errori.


## VC-016 — Risoluzione segnalazione

### EC-VC016-001 — Risoluzione prima della comunicazione

Caso:
un admin prova a marcare come risolta una segnalazione ancora `Segnalata`, pending o rifiutata.

Gestione prevista:
il server rifiuta la transizione. La CTA admin e visibile solo per report approvati con stato pubblico `Comunicata`, ma la regola resta verificata dal dominio e dal layer applicativo.

### EC-VC016-002 — Doppio click o modifica concorrente

Caso:
due invii quasi simultanei provano a risolvere la stessa segnalazione.

Gestione prevista:
il salvataggio richiede che lo stato pubblico atteso sia ancora `Comunicata`. Se lo stato e gia cambiato, viene restituito un errore controllato e non viene duplicato `ReportResolved`.

### EC-VC016-003 — Nota interna di risoluzione

Caso:
l'admin aggiunge una nota su come la risoluzione e stata verificata.

Gestione prevista:
la nota viene normalizzata, limitata a 1000 caratteri e salvata in `metadata.internalNote` dell'evento `ReportResolved`. La timeline admin la mostra come nota interna; la timeline pubblica mostra solo label, descrizione e data dell'evento.

### EC-VC016-004 — Report risolto sulla mappa

Caso:
una segnalazione passa a `Risolta`.

Gestione prevista:
resta visibile nella mappa pubblica e puo essere distinta dal filtro stato `Risolta`, cosi rimane memoria pubblica dei problemi risolti.

## VC-021B — Geocoding e selezione posizione

### EC-VC021B-001 — Provider geocoding non disponibile

Caso:
la ricerca indirizzo o il reverse geocoding falliscono per rete, quota o errore provider.

Gestione prevista:
il form mostra un messaggio comprensibile e resta utilizzabile. L'utente puo selezionare il punto direttamente sulla mappa; se il reverse geocoding fallisce, le coordinate valide restano confermate e l'indirizzo puo restare vuoto o testuale.

### EC-VC021B-002 — Indirizzo modificato dopo selezione

Caso:
l'utente seleziona un suggerimento o ottiene un indirizzo da geolocalizzazione/reverse geocoding, poi modifica manualmente il testo.

Gestione prevista:
la posizione viene marcata come non confermata e le coordinate non vengono inviate. Per proseguire l'utente deve selezionare un nuovo suggerimento, usare la geolocalizzazione o scegliere il punto sulla mappa. Questo evita di associare coordinate vecchie a un indirizzo modificato.

### EC-VC021B-003 — Risultati fuori Venafro

Caso:
il provider restituisce risultati lontani dal territorio iniziale del progetto.

Gestione prevista:
le query sono biasate verso Venafro, Molise, Italia, ma non viene imposto un geofence rigido perche non esiste ancora una business rule che blocchi segnalazioni fuori Comune.

### EC-VC021B-004 — Mappa non caricabile nel form

Caso:
MapLibre o lo style della mappa non si caricano.

Gestione prevista:
il form mostra un messaggio di errore e resta utilizzabile tramite ricerca indirizzo o geolocalizzazione. La mappa non e l'unico modo per impostare la posizione.
