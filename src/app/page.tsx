import { readBaseEnv } from "@/shared/config/env";

export default function Home() {
  const env = readBaseEnv();

  return (
    <main className="bootstrap-page">
      <section className="bootstrap-panel" aria-labelledby="bootstrap-title">
        <p className="eyebrow">Bootstrap tecnico</p>
        <h1 id="bootstrap-title">{env.appName}</h1>
        <p>
          Fondazione Next.js pronta. Le funzionalita applicative saranno
          implementate nelle prossime vertical slice approvate.
        </p>
      </section>
    </main>
  );
}

