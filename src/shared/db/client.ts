import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

export function createDatabase(databaseUrl = process.env.DATABASE_URL): Database {
  return createDatabaseConnection(databaseUrl).db;
}

export type DatabaseConnection = {
  db: Database;
  close: () => Promise<void>;
};

export function createDatabaseConnection(
  databaseUrl = process.env.DATABASE_URL
): DatabaseConnection {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a database connection.");
  }

  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false
  });

  return {
    db: drizzle(client, { schema, casing: "snake_case" }),
    close: () => client.end()
  };
}
