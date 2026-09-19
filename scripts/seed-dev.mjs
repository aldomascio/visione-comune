import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to seed development data.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

const legacyProvisionalCategoryIds = [
  "provisional-roads",
  "provisional-lighting",
  "provisional-waste-decorum"
];

function contentDocumentFromText(value) {
  const paragraphs = value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }]
    }));

  return { type: "doc", content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }] };
}

const newsPosts = [
  {
    id: "seed-news-territorio-ascolto",
    title: "Un punto di ascolto digitale per il territorio",
    slug: "punto-ascolto-digitale-territorio",
    excerpt: "Visione Comune sperimenta uno spazio semplice per raccogliere problemi, seguirli e renderli visibili.",
    image: "/news/territorio.svg",
    imageAlt: "Illustrazione Visione Comune dedicata al territorio",
    content: `Visione Comune nasce con l'idea di rendere piu semplice il rapporto tra cittadini, territorio e istituzioni.

La piattaforma permette di raccogliere segnalazioni civiche senza account, documentarle e seguirne l'evoluzione nel tempo.

L'obiettivo non e sostituire gli enti competenti, ma creare memoria pubblica e continuita: un problema segnalato non deve sparire nel silenzio.`
  },
  {
    id: "seed-news-mappa-segnalazioni",
    title: "La mappa pubblica rende consultabili le segnalazioni approvate",
    slug: "mappa-pubblica-segnalazioni-approvate",
    excerpt: "Le segnalazioni verificate possono essere consultate su una mappa pubblica, con stato e collegamento alla scheda dettaglio.",
    image: "/news/mappa.svg",
    imageAlt: "Illustrazione della mappa pubblica delle segnalazioni",
    content: `La mappa pubblica aiuta a leggere i problemi del territorio in modo immediato.

Sono visibili solo le segnalazioni gia approvate, cosi il cittadino consulta informazioni verificate e non dati ancora in moderazione.

Ogni punto rimanda alla scheda pubblica, dove e possibile seguire lo stato della segnalazione.`
  },
  {
    id: "seed-news-codice-tracking",
    title: "Ogni segnalazione ha un codice per seguirne lo stato",
    slug: "codice-tracking-segnalazione",
    excerpt: "Il codice pubblico permette di controllare una segnalazione senza creare account e senza fornire dati personali.",
    image: "/news/segnalazioni.svg",
    imageAlt: "Illustrazione di una segnalazione con codice pubblico",
    content: `Dopo l'invio, ogni segnalazione riceve un codice pubblico.

Il codice permette di controllare lo stato anche senza registrazione, email o numero di telefono.

Questo mantiene il flusso leggero per i cittadini e coerente con il principio di minimizzazione dei dati personali.`
  },
  {
    id: "seed-news-verde-pubblico",
    title: "Verde pubblico e manutenzione: segnalare aiuta a creare priorita",
    slug: "verde-pubblico-manutenzione-priorita",
    excerpt: "Le segnalazioni sul verde urbano contribuiscono a documentare criticita ricorrenti e interventi necessari.",
    image: "/news/verde.svg",
    imageAlt: "Illustrazione sul verde pubblico e la manutenzione urbana",
    content: `Vegetazione non curata, marciapiedi ostruiti e aree verdi degradate incidono sulla qualita della vita quotidiana.

Raccogliere queste informazioni in modo ordinato permette di avere un quadro piu chiaro delle criticita.

La documentazione pubblica aiuta anche a seguire cosa e stato comunicato e cosa resta da risolvere.`
  },
  {
    id: "seed-news-illuminazione",
    title: "Illuminazione pubblica: perche contano anche le piccole segnalazioni",
    slug: "illuminazione-pubblica-piccole-segnalazioni",
    excerpt: "Un lampione spento puo sembrare un dettaglio, ma spesso incide su sicurezza percepita e vivibilita degli spazi.",
    image: "/news/illuminazione.svg",
    imageAlt: "Illustrazione sull'illuminazione pubblica",
    content: `Un punto luce spento puo rendere meno sicuro un attraversamento, una strada o un ingresso.

La piattaforma consente di documentare anche problemi puntuali, geolocalizzandoli e mantenendone traccia.

Quando una segnalazione viene verificata, puo essere comunicata agli uffici competenti e seguita nel tempo.`
  },
  {
    id: "seed-news-decoro-rifiuti",
    title: "Decoro urbano e rifiuti abbandonati: documentare senza creare rumore",
    slug: "decoro-urbano-rifiuti-abbandonati",
    excerpt: "Le segnalazioni non sono uno sfogo social: servono a rendere chiaro dove intervenire e cosa e gia stato comunicato.",
    image: "/news/rifiuti.svg",
    imageAlt: "Illustrazione su decoro urbano e rifiuti abbandonati",
    content: `Il tema del decoro urbano richiede informazioni precise, foto quando utili e una gestione ordinata.

Visione Comune non apre commenti o discussioni sulle segnalazioni: il focus resta sul problema, sulla verifica e sullo stato.

Questo aiuta a evitare confusione e a costruire una memoria consultabile degli interventi necessari.`
  },
  {
    id: "seed-news-partecipazione",
    title: "Partecipazione civica senza account: una scelta precisa",
    slug: "partecipazione-civica-senza-account",
    excerpt: "L'MVP non richiede account ai cittadini: l'obiettivo e ridurre attrito e raccogliere solo i dati necessari.",
    image: "/news/partecipazione.svg",
    imageAlt: "Illustrazione sulla partecipazione civica senza account",
    content: `La partecipazione deve essere accessibile anche a chi non vuole creare un profilo o lasciare contatti personali.

Per questo il flusso di segnalazione non richiede registrazione, nome, email o telefono.

Il codice pubblico permette comunque di controllare l'evoluzione della segnalazione dopo l'invio.`
  },
  {
    id: "seed-news-comunicazioni-enti",
    title: "Dalla segnalazione alla comunicazione agli enti competenti",
    slug: "segnalazione-comunicazione-enti-competenti",
    excerpt: "Il percorso non si ferma alla pubblicazione: le segnalazioni possono essere comunicate e aggiornate nel tempo.",
    image: "/news/comunicazioni.svg",
    imageAlt: "Illustrazione sulle comunicazioni agli enti competenti",
    content: `Una segnalazione approvata puo essere presa in carico operativamente da Visione Comune e comunicata agli enti competenti.

La piattaforma distingue tra segnalazione pubblicata, comunicazione inviata e problema risolto.

Questa distinzione evita promesse implicite e rende piu chiaro a che punto si trova ogni caso.`
  }
];

try {
  await sql`
    update categories
    set active = false, updated_at = now()
    where id in ${sql(legacyProvisionalCategoryIds)}
  `;

  const baseDate = new Date("2026-09-01T09:00:00.000Z");
  for (const [index, post] of newsPosts.entries()) {
    const publishedAt = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000);
    await sql`
      insert into news_posts (
        id,
        title,
        slug,
        excerpt,
        featured_image_url,
        featured_image_alt,
        content,
        content_json,
        status,
        published_at,
        created_at,
        updated_at
      ) values (
        ${post.id},
        ${post.title},
        ${post.slug},
        ${post.excerpt},
        ${post.image},
        ${post.imageAlt},
        ${post.content},
        ${contentDocumentFromText(post.content)},
        'published',
        ${publishedAt},
        ${publishedAt},
        now()
      )
      on conflict (id) do update set
        title = excluded.title,
        slug = excluded.slug,
        excerpt = excluded.excerpt,
        featured_image_url = excluded.featured_image_url,
        featured_image_alt = excluded.featured_image_alt,
        content = excluded.content,
        content_json = excluded.content_json,
        status = excluded.status,
        published_at = excluded.published_at,
        updated_at = now()
    `;
  }

  console.log("Disabled legacy provisional development categories.");
  console.log(`Seeded ${newsPosts.length} development news posts.`);
} finally {
  await sql.end();
}
