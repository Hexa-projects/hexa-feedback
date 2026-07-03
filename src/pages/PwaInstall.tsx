import { CheckCircle2, Download, Smartphone, Monitor, Apple, Zap, Wifi, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export default function PwaInstall() {
  const { canInstall, isInstalled, platform, promptInstall, resetDismiss } = usePwaInstall();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Aplicativo HexaOS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Instale o HexaOS no seu dispositivo para uma experiência mais rápida e em tela cheia.
        </p>
      </header>

      <Card className="p-4 flex items-center gap-3">
        {isInstalled ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="font-medium">Instalado</p>
              <p className="text-xs text-muted-foreground">
                Você está usando o HexaOS como aplicativo.
              </p>
            </div>
          </>
        ) : (
          <>
            <Download className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium">Não instalado</p>
              <p className="text-xs text-muted-foreground">
                Instale para acessar mais rápido pela tela inicial.
              </p>
            </div>
            {canInstall && (
              <Button
                onClick={() => {
                  resetDismiss();
                  void promptInstall();
                }}
              >
                Instalar app
              </Button>
            )}
          </>
        )}
      </Card>

      <section className="grid sm:grid-cols-2 gap-3">
        <Card className="p-4 flex items-start gap-3">
          <Zap className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium">Abertura rápida</p>
            <p className="text-xs text-muted-foreground">Ícone direto na tela inicial.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <Maximize2 className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium">Tela cheia</p>
            <p className="text-xs text-muted-foreground">Sem barras do navegador.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <Wifi className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium">Aviso de conexão</p>
            <p className="text-xs text-muted-foreground">Feedback claro quando offline.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <Download className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium">Carregamento mais rápido</p>
            <p className="text-xs text-muted-foreground">Recursos essenciais em cache seguro.</p>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Como instalar</h2>

        <Card className={`p-4 ${platform === "android" ? "border-primary" : ""}`}>
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4" />
            <p className="font-medium">Android (Chrome)</p>
          </div>
          <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
            <li>Toque no menu ⋮ do navegador.</li>
            <li>Selecione “Instalar aplicativo” ou “Adicionar à tela inicial”.</li>
            <li>Confirme em “Instalar”.</li>
          </ol>
          {platform === "android" && canInstall && (
            <Button className="mt-3" size="sm" onClick={() => void promptInstall()}>
              Instalar agora
            </Button>
          )}
        </Card>

        <Card className={`p-4 ${platform === "ios" ? "border-primary" : ""}`}>
          <div className="flex items-center gap-2 mb-2">
            <Apple className="w-4 h-4" />
            <p className="font-medium">iPhone / iPad (Safari)</p>
          </div>
          <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
            <li>Toque no botão Compartilhar do Safari.</li>
            <li>Escolha “Adicionar à Tela de Início”.</li>
            <li>Confirme em “Adicionar”.</li>
          </ol>
        </Card>

        <Card className={`p-4 ${platform === "desktop" ? "border-primary" : ""}`}>
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-4 h-4" />
            <p className="font-medium">Desktop (Chrome / Edge)</p>
          </div>
          <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
            <li>Clique no ícone de instalação na barra de endereço.</li>
            <li>Ou abra o menu do navegador e escolha “Instalar HexaOS”.</li>
          </ol>
          {platform === "desktop" && canInstall && (
            <Button className="mt-3" size="sm" onClick={() => void promptInstall()}>
              Instalar agora
            </Button>
          )}
        </Card>
      </section>
    </div>
  );
}
