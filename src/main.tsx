import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import PwaInstallPrompt from "./components/pwa/PwaInstallPrompt";
import PwaUpdateToast from "./components/pwa/PwaUpdateToast";
import OfflineBanner from "./components/pwa/OfflineBanner";

createRoot(document.getElementById("root")!).render(
  <>
    <OfflineBanner />
    <App />
    <PwaInstallPrompt />
    <PwaUpdateToast />
  </>,
);
