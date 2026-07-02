import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[80] bg-amber-500/95 text-black text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-2 backdrop-blur">
      <WifiOff className="w-3.5 h-3.5" />
      Você está offline — algumas funções podem não estar disponíveis.
    </div>
  );
}
