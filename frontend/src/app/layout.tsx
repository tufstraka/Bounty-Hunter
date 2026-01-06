import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Web3Provider } from '@/contexts/Web3Context';
import { Navigation } from '@/components/Navigation';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'FixFlow — Automated Bug Bounties',
  description: 'Fix bugs, get paid instantly. Automated debugging bounty system powered by MNEE stablecoin.',
  keywords: ['bug bounty', 'open source', 'MNEE', 'stablecoin', 'ethereum', 'developer', 'rewards'],
  authors: [{ name: 'FixFlow' }],
  openGraph: {
    title: 'FixFlow — Automated Bug Bounties',
    description: 'Fix bugs, get paid instantly. Automated debugging bounty system.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FixFlow — Automated Bug Bounties',
    description: 'Fix bugs, get paid instantly.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ff9500',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <Web3Provider>
            <div className="min-h-screen flex flex-col">
              <Navigation />
              <main className="flex-1">
                {children}
              </main>
            </div>
          </Web3Provider>
        </AuthProvider>
      </body>
    </html>
  );
}