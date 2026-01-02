import type { Metadata } from 'next';
import { Inter, Roboto } from 'next/font/google';
import './globals.css';
import SessionProvider from '@/components/SessionProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RealtimeProvider } from '@/components/RealtimeProvider';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const roboto = Roboto({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Premier League Predictions',
  description: 'Predict Premier League match scores and compete on the leaderboard',
  keywords: ['Premier League', 'football', 'predictions', 'leaderboard', 'EPL'],
  authors: [{ name: 'Premier League Predictions' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#38003c',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${roboto.variable}`}>
      <body className="antialiased min-h-screen bg-background text-foreground">
        <ErrorBoundary>
          <SessionProvider>
            <RealtimeProvider>
              <div className="flex flex-col min-h-screen">
                {children}
              </div>
            </RealtimeProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
