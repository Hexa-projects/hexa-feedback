import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
const APP_VERSION = pkg.version || "0.0.0";
const BUILD_TIME = new Date().toISOString();



// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION),
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
        cleanupOutdatedCaches: true,
        clientsClaim: false,
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
          // SPA navigations: network-first with offline fallback
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "hexaos-pages",
              networkTimeoutSeconds: 5,
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
