import { useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const WEBHOOKS = [
  { key: "webhook_diretoria", label: "Diretoria (Focus)", agent: "Focus AI" },
  { key: "webhook_comercial", label: "Comercial (Hunter)", agent: "Hunter" },
  { key: "webhook_operacoes", label: "Operações (Gear)", agent: "Gear" },
  { key: "webhook_laboratorio", label: "Laboratório (Tracker)", agent: "Tracker" },
  { key: "webhook_financeiro", label: "Financeiro (Ledger)", agent: "Ledger" },
];

export default function TeamsConfig() {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      const { error } = await supabase.from("integration_configs").upsert({
        integration_name: "ms_teams",
        config: values,
        updated_by: user?.id,
      }, { onConflict: "integration_name" });
      if (error) throw error;
      toast.success("Webhooks salvos com sucesso");
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleTest = async (key: string) => {
    setTesting(key);
    const url = values[key];
    if (!url) { toast.error("URL não preenchida"); setTesting(null); return; }
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "✅ HexaOS - Teste de conexão MS Teams" }),
      });
      toast.success("Mensagem de teste enviada!");
    } catch { toast.error("Falha na conexão"); }
    setTesting(null);
  };

  return (
    <HexaLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configuração MS Teams</h1>
          <p className="text-sm text-muted-foreground">Webhooks de notificação por agente</p>
        </div>

        <Card className="cyber-card cyber-glow">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Incoming Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {WEBHOOKS.map(wh => (
              <div key={wh.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{wh.label}</Label>
                <div className="flex gap-2">
                  <Input placeholder={`https://outlook.office.com/webhook/...`}
                    value={values[wh.key] || ""}
                    onChange={e => setValues(v => ({ ...v, [wh.key]: e.target.value }))}
                    className="bg-muted/30 border-border/40 text-sm" />
                  <Button size="sm" variant="outline" className="shrink-0 text-xs"
                    disabled={testing === wh.key}
                    onClick={() => handleTest(wh.key)}>
                    {testing === wh.key ? <CheckCircle className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
            <Button onClick={handleSave} className="w-full mt-4">Salvar Webhooks</Button>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
