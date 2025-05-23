/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/pushups',
      },
    ];
  },
  images: {
    domains: ['localhost'],
  },
  webpack: (config) => {
    // This is required to make MediaPipe work with Webpack 5
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    return config;
  },
};

module.exports = nextConfig;
