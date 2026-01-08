import { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fixflow.locsafe.org';

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date().toISOString();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/bounties`,
      lastModified: currentDate,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: '2026-01-06',
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: '2026-01-06',
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // const bounties = await fetchBounties();
  // const bountyPages = bounties.map((bounty) => ({
  //   url: `${siteUrl}/bounties/${bounty.id}`,
  //   lastModified: bounty.updatedAt,
  //   changeFrequency: 'daily' as const,
  //   priority: 0.7,
  // }));

  return [
    ...staticPages,
    // ...bountyPages,
  ];
}