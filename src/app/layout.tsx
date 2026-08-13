import type { Metadata } from "next";
import Script from "next/script";

import "@/presentation/styles/globals.css";

export const metadata: Metadata = {
  title: "Persona Room — Rina is listening",
  description: "A live virtual persona experience built for Aria Studios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="persona-room-theme" strategy="beforeInteractive">
          {`try {
  const stored = window.localStorage.getItem("persona-room-theme");
  const theme = stored === "light" || stored === "dark"
    ? stored
    : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.dataset.theme = theme;
} catch {}`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
