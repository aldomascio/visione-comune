# User Flows

## FLOW-001 — Nuova segnalazione

1. L'utente apre "Segnala un problema".
2. Seleziona una categoria.
3. Indica una posizione.
4. Inserisce una descrizione.
5. Può caricare una foto.
6. Il sistema verifica possibili duplicati.
7. Se trova corrispondenze:
   - mostra le segnalazioni simili;
   - permette di aprire la scheda pubblica della segnalazione esistente;
   - permette di aprire la scheda pubblica e confermare la segnalazione esistente;
   - permette di continuare se il problema è diverso.
8. L'utente invia.
9. Il sistema genera un codice univoco.
10. La segnalazione entra nello stato interno `Da verificare`.
11. L'utente visualizza e può copiare il codice.

## FLOW-002 — Moderazione

1. L'amministratore apre una segnalazione.
2. Controlla contenuto, posizione, foto e categoria.
3. Controlla possibili duplicati.
4. Conferma o modifica la categoria.
5. Approva oppure rifiuta.
6. Se approvata:
   - diventa pubblica;
   - compare sulla mappa;
   - stato pubblico = `Segnalata`.
7. Nel dettaglio admin viene mostrata la timeline completa con eventi interni e pubblici, inclusa l'eventuale nota interna di rifiuto.

## FLOW-003 — Conferma di una segnalazione

1. Il cittadino apre una segnalazione pubblica.
2. Visualizza il conteggio aggregato delle conferme.
3. Clicca "Conferma anche tu".
4. Il sistema usa un identificatore anonimo first-party per limitare doppie conferme banali dallo stesso browser.
5. Se non aveva gia confermato, registra la conferma.
6. Il conteggio pubblico viene aggiornato.
7. Se aveva gia confermato, non crea duplicati e mostra lo stato gia confermato.

## FLOW-004 — Comunicazione all'ente

1. La segnalazione è approvata.
2. Il sistema suggerisce il destinatario.
3. L'operatore verifica.
4. Il sistema propone un template deterministico modificabile.
5. L'operatore registra manualmente la comunicazione come bozza o inviata. Nessun invio reale viene effettuato dalla piattaforma.
6. Se l'operatore conferma manualmente la consegna:
   - lo stato pubblico passa a `Comunicata`;
   - viene aggiunto un evento pubblico in timeline.
7. Se la comunicazione viene marcata fallita, resta visibile solo in admin e lo stato pubblico non cambia.

## FLOW-005 — Risoluzione

1. Visione Comune verifica che il problema sia risolto.
2. L'amministratore imposta lo stato `Risolta`.
3. Viene registrato l'evento in timeline.
4. La scheda pubblica viene aggiornata.

## FLOW-006 — Tracking tramite codice

1. L'utente inserisce il codice univoco.
2. Il sistema recupera la segnalazione.
3. Se la segnalazione e ancora da verificare, mostra un messaggio di verifica in corso senza esporre la scheda pubblica.
4. Se la segnalazione e approvata, mostra la scheda pubblica con stato e timeline pubblica.
5. La timeline pubblica mostra solo eventi pubblici con label, descrizione e data comprensibili.
6. Se la segnalazione e rifiutata, mostra un messaggio generico di mancata pubblicazione senza note interne o motivazioni operative.
