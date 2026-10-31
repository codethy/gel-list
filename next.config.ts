import type { NextConfig } from "next";

// Without-nonces CSP (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)
// — a nonce-based strict CSP would require every page to opt into dynamic
// rendering and a proxy.ts-generated nonce threaded through the whole app;
// this is the pragmatic middle ground: it still blocks framing (clickjacking),
// restricts which origins images/scripts/connections can come from, and
// blocks <object>/<embed>, at the cost of 'unsafe-inline' for scripts/styles
// (Next.js's own hydration/inline styles need this without nonces).
const isDev = process.env.NODE_ENV === "development";
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://lh3.googleusercontent.com https://*.ufs.sh;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google profile pictures
      },
      {
        protocol: "https",
        hostname: "*.ufs.sh", // UploadThing CDN — card photos, set banners
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
