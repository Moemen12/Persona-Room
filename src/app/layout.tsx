import type { Metadata } from 'next';
import { AuthProvider } from '@/presentation/contexts/AuthContext';
import '@/presentation/styles/globals.css';

export const metadata: Metadata = {
  title: 'Persona Room',
  description: 'Chat with Rina, a virtual artist with genuine personality',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
