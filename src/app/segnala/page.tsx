import type { CategoryOption } from "@/modules/categories/application/category-repository";
import { DrizzleCategoryRepository } from "@/modules/categories/infrastructure/drizzle-category-repository";
import { readPublicMapConfig } from "@/shared/config/map";
import { createDatabaseConnection } from "@/shared/db/client";
import { ReportTaskShell } from "./report-task-shell";

export const dynamic = "force-dynamic";

export default async function ReportSubmissionPage() {
  const categories = await getActiveCategories();
  const mapConfig = readPublicMapConfig();

  return <ReportTaskShell categories={categories} mapConfig={mapConfig} />;
}

async function getActiveCategories(): Promise<CategoryOption[]> {
  let connection;

  try {
    connection = createDatabaseConnection();
    const categories = await new DrizzleCategoryRepository(connection.db).listActive();

    return categories;
  } catch (error) {
    console.error("Unable to load active categories", error);
    return [];
  } finally {
    await connection?.close();
  }
}
