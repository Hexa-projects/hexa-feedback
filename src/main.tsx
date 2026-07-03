import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import PwaInstallPrompt from "./components/pwa/PwaInstallPrompt";
import PwaUpdatePrompt from "./components/pwa/PwaUpdatePrompt";
import OfflineBanner from "./components/pwa/OfflineBanner";
import { AppErrorBoundary, armChunkRecovery } from "./components/AppErrorBoundary";

armChunkRecovery();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <OfflineBanner />
    <App />
    <PwaInstallPrompt />
    <PwaUpdatePrompt />
  </AppErrorBoundary>,
);
