import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClientProviders } from '@/providers/client-providers';
import { APP_METADATA } from '@/lib/constants';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_METADATA.TITLE,
  description: APP_METADATA.DESCRIPTION,
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased font-sans`}>
        <ClientProviders modal={modal}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
