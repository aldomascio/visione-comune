import { PublicLegalPage } from "@/shared/legal/public-legal-page";

export default function AccessibilityPage() {
  return (
    <PublicLegalPage
      introduction="Informazioni sulle funzionalità predisposte per rendere più accessibili i contenuti e i servizi di Visione Comune."
      title="Accessibilità"
    >
      <section className="grid gap-3">
        <h2>Navigazione</h2>
        <p>Le pagine utilizzano titoli gerarchici, label associate ai campi, stati di focus visibili e testi alternativi per le immagini informative disponibili.</p>
      </section>

      <section className="grid gap-3">
        <h2>Strumenti di supporto</h2>
        <p>Il widget AccessiYes è disponibile su desktop e dispositivi mobili tramite il pulsante dedicato. Può essere aperto anche con la scorciatoia da tastiera Alt+A oppure Option+A su macOS.</p>
      </section>

      <section className="grid gap-3">
        <h2>Contenuti cartografici</h2>
        <p>Le informazioni presenti sulla mappa pubblica sono disponibili anche come elenco testuale, con titolo, indirizzo e stato della segnalazione.</p>
      </section>

      <section className="grid gap-3">
        <h2>Miglioramento continuo</h2>
        <p>Gli strumenti automatici integrano il lavoro sull’accessibilità, ma non sostituiscono verifiche tecniche e correzioni del codice.</p>
      </section>
    </PublicLegalPage>
  );
}
