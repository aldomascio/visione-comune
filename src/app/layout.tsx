import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import { PublicShell } from "@/shared/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visione Comune",
  description: "Fondazione tecnica del progetto Visione Comune"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body suppressHydrationWarning><PublicShell>{children}</PublicShell></body>
    </html>
  );
}

