import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { CurrencyProvider } from '@/contexts/currency-context';
import { APP_METADATA } from '@/lib/constants';
import { Toaster } from '@/components/ui/sonner';
import { TransactionModalProvider } from '@/features/transactions/contexts/transaction-modal-context';
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
  modal, // <-- ADD THIS
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode; // <-- ADD THIS
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased font-sans`}
      >
        <QueryProvider>
          <CurrencyProvider>
            <AuthProvider>
              <TransactionModalProvider>
                {children}
                {modal}
                <Toaster />
              </TransactionModalProvider>
            </AuthProvider>
          </CurrencyProvider>
        </QueryProvider>
      </body>
    </html>
  );
}