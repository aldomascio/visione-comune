import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import { AccessiYesWidget } from "@/shared/accessibility/accessiyes-widget";
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

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={lora.variable} lang="it">
      <body suppressHydrationWarning>
        <PublicShell>{children}</PublicShell>
        <AccessiYesWidget />
      </body>
    </html>
  );
}
