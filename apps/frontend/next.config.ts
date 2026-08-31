import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { serverEnv } from "./src/env";

/**
 * Security-Header für jede Antwort. Der Reverse Proxy in Produktion darf
 * ergänzen, nicht abschwächen. CSP wird in Phase 3 mit dem Design-System
 * und dem Objektspeicher-Host verschärft.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Schlankes, eigenständiges Server-Bundle für das Container-Image.
  output: "standalone",
  // Monorepo: Workspace-Wurzel liegt zwei Ebenen höher.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  // Shared-Workspace-Paket direkt aus TS-Quelle transpilen.
  transpilePackages: ["@humatter-leads/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Alle API-Aufrufe an das Backend im internen Docker-Netzwerk weiterreichen.
  // Der Browser spricht so nur mit dem Frontend-Origin (First-Party-Cookies,
  // kein CORS). Das Backend ist nie direkt öffentlich.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${serverEnv.BACKEND_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
