import type { NextConfig } from "next";

const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  // The banner poster engine runs inside the admin's job runner: resvg is a native module and satori loads WASM,
  // so both stay as plain Node packages instead of being bundled.
  serverExternalPackages: ["@resvg/resvg-js", "satori"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async redirects() {
    return [
      { source: "/contact", destination: "/#order", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
