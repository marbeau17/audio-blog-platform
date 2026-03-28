/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-eval' https://js.stripe.com https://apis.google.com; frame-src https://js.stripe.com https://audio-blog-platform.firebaseapp.com https://accounts.google.com; connect-src 'self' https://api.stripe.com https://firestore.googleapis.com https://storage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://accounts.google.com https://*.firebaseio.com wss://*.firebaseio.com http://localhost:* https://*.run.app; img-src 'self' https://storage.googleapis.com https://firebasestorage.googleapis.com https://lh3.googleusercontent.com data:; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com",
        },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
      ],
    },
  ],
};

module.exports = nextConfig;
