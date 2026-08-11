import type { Metadata } from "next";

import "@/presentation/styles/globals.css";

export const metadata: Metadata = {
  title: "Persona Room — Rina is listening",
  description: "A live virtual persona experience built for Aria Studios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
