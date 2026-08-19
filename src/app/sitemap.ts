import { MetadataRoute } from 'next';
import { getClusters, getCategories } from '@/lib/mongodb';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/search`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/submit`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const [clusters, categories] = await Promise.all([getClusters(), getCategories()]);

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/browse/${c.id}`,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const clusterRoutes: MetadataRoute.Sitemap = clusters.map((cluster) => ({
    url: `${SITE_URL}/cluster/${cluster.id}`,
    lastModified: cluster.lastUpdatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...clusterRoutes];
}
