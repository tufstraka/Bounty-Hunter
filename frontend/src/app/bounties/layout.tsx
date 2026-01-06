import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore Bounties',
  description: 'Browse and claim bug bounties on FixFlow. Earn MNEE tokens by fixing bugs in open source projects. Find active bounties with escalating rewards.',
  keywords: ['bug bounties', 'earn crypto', 'MNEE tokens', 'open source', 'fix bugs', 'developer rewards', 'blockchain payments'],
  openGraph: {
    title: 'Explore Bounties | FixFlow',
    description: 'Browse and claim bug bounties. Earn MNEE tokens by fixing bugs in open source projects.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore Bounties | FixFlow',
    description: 'Browse and claim bug bounties. Earn MNEE tokens by fixing bugs.',
  },
  alternates: {
    canonical: '/bounties',
  },
};

export default function BountiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}