import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to seed development categories.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

const provisionalCategories = [
  {
    id: "provisional-roads",
    name: "Strade e marciapiedi (provvisoria)",
    slug: "strade-marciapiedi-provvisoria"
  },
  {
    id: "provisional-lighting",
    name: "Illuminazione pubblica (provvisoria)",
    slug: "illuminazione-pubblica-provvisoria"
  },
  {
    id: "provisional-waste-decorum",
    name: "Rifiuti e decoro urbano (provvisoria)",
    slug: "rifiuti-decoro-urbano-provvisoria"
  }
];

try {
  for (const category of provisionalCategories) {
    await sql`
      insert into categories (id, name, slug, active)
      values (${category.id}, ${category.name}, ${category.slug}, true)
      on conflict (id) do update set
        name = excluded.name,
        slug = excluded.slug,
        active = true,
        updated_at = now()
    `;
  }

  console.log(`Seeded ${provisionalCategories.length} provisional development categories.`);
} finally {
  await sql.end();
}
