import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
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
  title: 'Finance Tracker - Manage Your Finances Across Multiple Currencies',
  description:
    'A personal finance tracking application that helps you manage your money across multiple accounts and currencies with a beautiful, intuitive interface.',
};

export default function RootLayout({
  children,
  modal, // <-- ADD THIS
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode; // <-- ADD THIS
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            {children}
            {modal} {/* <-- ADD THIS */}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}