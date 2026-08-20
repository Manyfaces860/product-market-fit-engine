/**
 * Single source of truth for the site's public URL, used everywhere crawler-facing
 * output is generated (metadataBase, robots.txt, sitemap.xml, OG tags).
 * Silently defaulting to localhost in a real production build would make Google
 * index the wrong domain, so this only allows that fallback outside production.
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Vercel injects this automatically for every deployment (production and preview)
  // without requiring the project owner to configure NEXT_PUBLIC_APP_URL by hand.
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL (or VERCEL_URL) must be set in production — crawler-facing metadata cannot default to localhost.'
    );
  }

  return 'http://localhost:3000';
}
