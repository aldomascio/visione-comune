import { PublicLegalPage } from "@/shared/legal/public-legal-page";

export default function CookiePolicyPage() {
  return (
    <PublicLegalPage
      introduction="Informazioni sugli strumenti tecnici utilizzati attualmente dalla piattaforma."
      title="Cookie Policy"
    >
      <section className="grid gap-3">
        <h2>Cookie per le conferme</h2>
        <p>
          Quando confermi una segnalazione pubblica, la piattaforma usa il cookie tecnico first-party
          <code className="mx-1 font-mono text-sm">vc_report_confirmation_id</code>
          per limitare conferme ripetute dallo stesso browser.
        </p>
        <ul>
          <li>non contiene nome, email o altri dati dichiarati dall’utente;</li>
          <li>è configurato come HttpOnly e SameSite=Lax;</li>
          <li>in produzione viene trasmesso solo tramite connessione sicura;</li>
          <li>ha una durata massima di 180 giorni.</li>
        </ul>
        <p>Se il cookie viene eliminato, la piattaforma non può più riconoscere la conferma precedente da quel browser.</p>
      </section>

      <section className="grid gap-3">
        <h2>Area amministrativa</h2>
        <p>L’area riservata agli amministratori usa cookie tecnici di sessione necessari per autenticare e proteggere l’accesso.</p>
      </section>

      <section className="grid gap-3">
        <h2>Strumenti di accessibilità</h2>
        <p>Il sito carica il widget AccessiYes per offrire strumenti di supporto alla navigazione. Il widget viene fornito tramite il servizio esterno configurato dalla piattaforma.</p>
      </section>

      <section className="grid gap-3">
        <h2>Profilazione</h2>
        <p>Le funzioni attualmente implementate non usano cookie pubblicitari o cookie destinati alla profilazione degli utenti.</p>
      </section>

      <section className="grid scroll-mt-24 gap-3" id="gestisci-preferenze">
        <h2>Gestisci le preferenze</h2>
        <p>I cookie tecnici descritti sono necessari per le rispettive funzionalità. Puoi eliminarli o bloccarli dalle impostazioni del browser; in questo caso la conferma precedente potrebbe non essere più riconosciuta e alcune funzioni riservate potrebbero non essere disponibili.</p>
      </section>
    </PublicLegalPage>
  );
}
