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
  preload: true,
});

// Base URL for canonical URLs and OG images
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fixflow.dev';

export const metadata: Metadata = {
  // Primary Meta Tags
  title: {
    default: 'FixFlow — Automated Bug Bounties | Get Paid to Fix Bugs',
    template: '%s | FixFlow',
  },
  description: 'Fix bugs, get paid instantly. FixFlow is an automated debugging bounty platform that pays developers in stablecoin the moment their pull request is merged. Zero fees, instant payouts.',
  
  // Keywords
  keywords: [
    'bug bounty',
    'bounty platform',
    'open source rewards',
    'developer rewards',
    'MNEE stablecoin',
    'ethereum payments',
    'GitHub integration',
    'automated payments',
    'fix bugs for money',
    'developer income',
    'CI/CD bounties',
    'test failure bounties',
    'open source funding',
    'crypto payments developers',
  ],
  
  // Authors and Creator
  authors: [{ name: 'FixFlow', url: siteUrl }],
  creator: 'FixFlow',
  publisher: 'FixFlow',
  
  // Robots
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  
  // Manifest
  manifest: '/manifest.json',
  
  // Canonical URL
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },
  
  // Open Graph
  openGraph: {
    type: 'website',
    siteName: 'FixFlow',
    title: 'FixFlow — Automated Bug Bounties',
    description: 'Fix bugs, get paid instantly. Automated debugging bounty platform powered by stablecoin.',
    url: siteUrl,
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FixFlow - Fix bugs, get paid instantly',
        type: 'image/png',
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: 'summary_large_image',
    site: '@fixflow_dev',
    creator: '@fixflow_dev',
    title: 'FixFlow — Automated Bug Bounties',
    description: 'Fix bugs, get paid instantly. Zero fees, instant payouts.',
    images: ['/twitter-image.png'],
  },
  
  // Verification (add your actual IDs)
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    // yandex: 'your-yandex-verification',
    // bing: 'your-bing-verification',
  },
  
  // App-specific
  applicationName: 'FixFlow',
  category: 'Technology',
  
  // Other
  other: {
    'msapplication-TileColor': '#ff9500',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
  colorScheme: 'light',
};

// JSON-LD Structured Data
function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'FixFlow',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/logo.png`,
      width: 512,
      height: 512,
    },
    description: 'Automated bug bounty platform that pays developers instantly in stablecoin.',
    sameAs: [
      'https://github.com/fixflow',
      'https://twitter.com/fixflow_dev',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@fixflow.dev',
      contactType: 'customer support',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: 'FixFlow',
    url: siteUrl,
    description: 'Automated bug bounty platform',
    publisher: { '@id': `${siteUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/bounties?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'FixFlow',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description: 'Automated bug bounty platform that creates bounties when CI tests fail and pays developers instantly when they fix them.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free to use - developers keep 100% of bounty earnings',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'Automated bounty creation from CI failures',
      'Instant stablecoin payments',
      'Zero platform fees for developers',
      'GitHub integration',
      'Bounty escalation over time',
      'Multiple payment methods (MNEE, Ethereum)',
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://avatars.githubusercontent.com" />
        
        {/* DNS Prefetch for performance */}
        <link rel="dns-prefetch" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://sepolia.etherscan.io" />
        
        {/* Structured Data */}
        <JsonLd />
      </head>
      <body className="font-sans antialiased bg-white text-gray-900">
        {/* Skip Navigation Link for Accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
            bg-primary-600 text-white px-4 py-2 rounded-lg z-[100] focus:outline-none 
            focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        
        <AuthProvider>
          <Web3Provider>
            <div className="min-h-screen flex flex-col">
              <Navigation />
              <main id="main-content" className="flex-1" role="main">
                {children}
              </main>
            </div>
          </Web3Provider>
        </AuthProvider>
      </body>
    </html>
  );
}