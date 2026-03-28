import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://audioblog.vercel.app', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://audioblog.vercel.app/content', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://audioblog.vercel.app/search', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://audioblog.vercel.app/auth/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: 'https://audioblog.vercel.app/auth/register', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
