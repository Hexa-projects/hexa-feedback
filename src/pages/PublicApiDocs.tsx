import ApiDocsContent from "@/components/ApiDocsContent";
import { Toaster as Sonner } from "@/components/ui/sonner";

export default function PublicApiDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sonner />
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
            H
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Documentação Pública</p>
            <h1 className="text-lg font-bold">HexaOS Platform</h1>
          </div>
        </div>
        <ApiDocsContent />
        <footer className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground">
          HexaOS © {new Date().getFullYear()} — Documentação para integrações externas e OpenClaw Gateway
        </footer>
      </div>
    </div>
  );
}
