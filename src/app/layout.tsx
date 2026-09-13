import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}

