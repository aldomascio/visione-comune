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
10. La segnalazione entra nello stato interno `Da verificare` con fonte interna `platform`; l'eventuale foto originale entra come `report_photo` in `pending_review`.
11. L'utente visualizza e può copiare il codice.
12. Il cittadino non vede e non sceglie la fonte della segnalazione.

## FLOW-002 — Moderazione

1. L'amministratore apre una segnalazione.
2. Controlla contenuto, posizione, categoria e allegati. La moderazione della segnalazione e la review delle foto sono decisioni separate.
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
2. La segnalazione deve essere gia `Comunicata`.
3. L'amministratore apre il dettaglio admin e usa `Segna come risolta`.
4. Prima della conferma puo inserire una nota interna opzionale sul metodo di verifica.
5. Il sistema chiede conferma esplicita per evitare click accidentali.
6. Il dominio imposta lo stato `Risolta`, valorizza `resolvedAt` e registra `ReportResolved`.
7. La timeline pubblica mostra `Problema risolto` senza note interne.
8. La timeline admin mostra anche l'eventuale nota interna.
9. La scheda pubblica e la mappa continuano a mostrare la segnalazione con stato `Risolta`.
10. Se disponibile, l'amministratore puo caricare una foto di verifica della risoluzione; la foto nasce `pending_review` e viene mostrata pubblicamente solo dopo approvazione.

## FLOW-006 — Tracking tramite codice

1. L'utente inserisce il codice univoco.
2. Il sistema recupera la segnalazione.
3. Se la segnalazione e ancora da verificare, mostra un messaggio di verifica in corso senza esporre la scheda pubblica.
4. Se la segnalazione e approvata, mostra la scheda pubblica con stato e timeline pubblica.
5. La timeline pubblica mostra solo eventi pubblici con label, descrizione e data comprensibili.
6. Se la segnalazione e rifiutata, mostra un messaggio generico di mancata pubblicazione senza note interne o motivazioni operative.
## FLOW-007 — Creazione manuale admin

1. L'amministratore autenticato apre `/admin/segnalazioni/nuova`.
2. Seleziona categoria e fonte della segnalazione tra `Segnalazione diretta`, `Social`, `Email`, `Altro` o `Piattaforma`.
3. Indica posizione e descrizione usando gli stessi vincoli del report pubblico.
4. Può allegare una foto opzionale se disponibile.
5. Il sistema genera un codice pubblico e registra la segnalazione come `Da verificare`.
6. Il sistema associa internamente la segnalazione all'admin autenticato che l'ha creata.
7. La segnalazione non viene approvata automaticamente e deve passare dal normale flusso di moderazione.
8. Il dettaglio admin mostra fonte e audit di creazione; le pagine pubbliche non li espongono.

## FLOW-008 — Pre-filtro automatico futuro

1. Prima della creazione o della moderazione, il sistema potra applicare controlli automatici leggeri su problemi oggettivi.
2. Il pre-filtro potra chiedere correzioni o bloccare casi tecnici evidenti, come file non validi, spam manifesto, linguaggio palesemente volgare o duplicati evidenti secondo regole gia definite.
3. Se il contenuto supera il pre-filtro, entra comunque in `Da verificare`.
4. La validita sostanziale, la pertinenza e il rischio di uso strumentale restano valutati da Visione Comune tramite moderazione umana.


## FLOW-009 — Duplicati post-submit

1. L'amministratore apre il dettaglio di una segnalazione.
2. Nella sezione `Duplicati` cerca una segnalazione principale per codice pubblico o titolo.
3. Il sistema mostra solo segnalazioni approvate, pubbliche e non gia duplicate, escludendo la segnalazione corrente.
4. L'amministratore collega la segnalazione alla principale.
5. Il duplicato mantiene codice, storico, allegati e conferme gia ricevute.
6. Il dettaglio admin del duplicato mostra `Duplicata di VC-XXXXXXXX` e permette la rimozione/correzione del collegamento.
7. Il dettaglio admin della principale mostra le segnalazioni collegate.
8. La scheda pubblica del duplicato resta accessibile e rimanda alla principale senza redirect automatico.
9. Le nuove conferme vengono raccolte sulla principale, non sul duplicato.
10. Il duplicato non compare come marker autonomo sulla mappa pubblica.

## FLOW-010 — Trasmissione manuale aggregata

1. L'amministratore apre `/admin/trasmissioni`.
2. Crea una nuova trasmissione.
3. Sceglie un destinatario attivo configurato nella matrice categoria → destinatario.
4. Il sistema mostra solo segnalazioni approvate, pubbliche, non duplicate, ancora `Segnalata` e compatibili con quel destinatario.
5. L'amministratore seleziona una o piu segnalazioni.
6. Il sistema propone un template deterministico multi-segnalazione, modificabile dall'amministratore.
7. L'amministratore salva la trasmissione come bozza.
8. Nessuna PEC o email viene inviata dalla piattaforma.
9. L'amministratore puo marcare manualmente la trasmissione come `Inviata`, senza cambiare lo stato pubblico delle segnalazioni.
10. L'amministratore puo marcare manualmente la trasmissione come `Consegnata`: le segnalazioni incluse ancora `Segnalata` diventano `Comunicata` e ricevono evento pubblico in timeline.
11. L'amministratore puo marcare manualmente la trasmissione come `Fallita`, senza cambiare lo stato pubblico delle segnalazioni.
12. Il dettaglio admin di ogni segnalazione mostra le trasmissioni collegate.
# Invio di una proposta

Il cittadino apre `/proponi`, descrive titolo, ambito e contenuto, sceglie obbligatoriamente tra invio anonimo e ricontatto via email, controlla il riepilogo e invia. La conferma non contiene codici o link di tracking. Un amministratore consulta la proposta nel backoffice e può impostarla come Nuova, Da approfondire o Archiviata.
