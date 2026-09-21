import { PublicLegalPage } from "@/shared/legal/public-legal-page";

export default function TermsPage() {
  return (
    <PublicLegalPage
      introduction="Condizioni essenziali per l’utilizzo dei servizi pubblici disponibili sulla piattaforma."
      title="Termini e condizioni"
    >
      <section className="grid gap-3">
        <h2>Finalità del servizio</h2>
        <p>Visione Comune permette di inviare segnalazioni sul territorio, seguirne gli aggiornamenti, consultare la mappa pubblica e proporre idee.</p>
      </section>

      <section className="grid gap-3">
        <h2>Segnalazioni</h2>
        <p>Le segnalazioni vengono verificate prima della pubblicazione. Contenuti non pertinenti, incoerenti o non pubblicabili possono essere rifiutati. Le immagini sono sottoposte a una verifica separata.</p>
      </section>

      <section className="grid gap-3">
        <h2>Uso responsabile</h2>
        <p>Chi utilizza il servizio deve fornire informazioni pertinenti al problema o alla proposta descritta e non deve caricare contenuti illeciti o dati personali non necessari.</p>
      </section>

      <section className="grid gap-3">
        <h2>Emergenze</h2>
        <p>La piattaforma non è un servizio di emergenza e non sostituisce i canali istituzionali da contattare quando è necessario un intervento immediato.</p>
      </section>

      <section className="grid gap-3">
        <h2>Proposte</h2>
        <p>Le proposte inviate tramite il percorso dedicato restano private e non vengono pubblicate nella mappa o tra le segnalazioni.</p>
      </section>
    </PublicLegalPage>
  );
}
