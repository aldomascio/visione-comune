import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import { GetPublicContactSettingsUseCase } from "@/modules/site-settings/application/manage-public-contact-settings";
import { DrizzlePublicContactSettingsRepository } from "@/modules/site-settings/infrastructure/drizzle-public-contact-settings-repository";
import { AccessiYesWidget } from "@/shared/accessibility/accessiyes-widget";
import { buildPublicContactLinks, readEnvironmentPublicContactSettings } from "@/shared/config/public-contact";
import { createDatabaseConnection } from "@/shared/db/client";
import { PublicShell } from "@/shared/navigation";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora"
});

export const metadata: Metadata = {
  title: "Visione Comune",
  description: "Fondazione tecnica del progetto Visione Comune",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png" }]
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const contactLinks = await getPublicContactLinks();

  return (
    <html className={lora.variable} lang="it">
      <body suppressHydrationWarning>
        <PublicShell contactLinks={contactLinks}>{children}</PublicShell>
        <AccessiYesWidget />
      </body>
    </html>
  );
}

async function getPublicContactLinks() {
  const environmentSettings = readEnvironmentPublicContactSettings();
  let connection;

  try {
    connection = createDatabaseConnection();
    const storedSettings = await new GetPublicContactSettingsUseCase(
      new DrizzlePublicContactSettingsRepository(connection.db)
    ).execute();

    return buildPublicContactLinks(storedSettings ?? environmentSettings);
  } catch {
    return buildPublicContactLinks(environmentSettings);
  } finally {
    await connection?.close();
  }
}
