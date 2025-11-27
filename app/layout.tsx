import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { CurrencyProvider } from '@/contexts/currency-context';
import { APP_METADATA } from '@/lib/constants';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: APP_METADATA.TITLE,
  description: APP_METADATA.DESCRIPTION,
};

export default function RootLayout({
  children,
  modal, // <-- ADD THIS
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode; // <-- ADD THIS
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <CurrencyProvider>
            <AuthProvider>
              {children}
              {modal} {/* <-- ADD THIS */}
              <Toaster />
            </AuthProvider>
          </CurrencyProvider>
        </QueryProvider>
      </body>
    </html>
  );
}