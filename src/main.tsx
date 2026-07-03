import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import OfflineBanner from "./components/pwa/OfflineBanner";
import { AppErrorBoundary, armChunkRecovery } from "./components/AppErrorBoundary";

armChunkRecovery();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <OfflineBanner />
    <App />
  </AppErrorBoundary>,
);

