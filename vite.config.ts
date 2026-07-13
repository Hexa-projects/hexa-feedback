import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
const APP_VERSION = pkg.version || "0.0.0";
const BUILD_TIME = new Date().toISOString();
const BUILD_ID =
  process.env.VITE_BUILD_ID ||
  process.env.GITHUB_SHA ||
  `${APP_VERSION}-${BUILD_TIME.replace(/[^0-9]/g, "").slice(0, 14)}`;

function buildVersionPlugin() {
  return {
    name: "hexaos-build-version",
    apply: "build" as const,
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(
          { app: "HexaOS", version: BUILD_ID, buildId: BUILD_ID, buildTime: BUILD_TIME },
          null,
        ),
      });
    },
  };
}



// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(BUILD_ID),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(BUILD_TIME),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    buildVersionPlugin(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.ico",
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
      ],
      manifest: {
        id: "/",
        name: "HexaOS",
        short_name: "HexaOS",
        description:
          "Sistema operacional empresarial da Hexa para gestão de produção, qualidade, estoque, comercial e operações.",
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "browser"],
        orientation: "any",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        categories: ["business", "productivity", "utilities"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          { name: "Qualidade", short_name: "Qualidade", url: "/quality" },
          { name: "RNC", short_name: "RNC", url: "/quality/rnc" },
          { name: "Ordens de Serviço", short_name: "OS", url: "/os" },
          { name: "Estoque", short_name: "Estoque", url: "/stock" },
          { name: "Comercial", short_name: "Comercial", url: "/crm" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        globIgnores: ["**/version.json"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // registerType:"prompt" requires a waiting worker until the user confirms.
        skipWaiting: false,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/auth/,
          /^\/rest\/v1/,
          /^\/storage\/v1/,
          /^\/functions\/v1/,
          /^\/realtime\/v1/,
        ],
        runtimeCaching: [
          // SPA navigations: always try network first, short timeout, then cache.
          // Ensures a freshly-deployed index.html is fetched instead of a stale one.
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "hexaos-pages",
              cacheableResponse: { statuses: [200] },
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          // Hashed static assets: cache-first
          {
            urlPattern: ({ request, sameOrigin }: any) =>
              sameOrigin &&
              ["style", "script", "worker", "font"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "hexaos-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Public images (same-origin only)
          {
            urlPattern: ({ request, sameOrigin }: any) =>
              sameOrigin && request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "hexaos-images",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
}));
