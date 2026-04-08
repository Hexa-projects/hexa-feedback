import { useState, useEffect } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Webhook, Shield, Loader2, CheckCircle2, XCircle, Send } from "lucide-react";

interface WebhookConfig {
  diretoria: string;
  comercial: string;
  operacoes: string;
  laboratorio: string;
  financeiro: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  comercial: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  operacoes: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  laboratorio: "bg-green-500/20 text-green-400 border-green-500/30",
  financeiro: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  general: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const DOMAIN_LABELS: Record<string, string> = {
  comercial: "Comercial",
  operacoes: "Operações",
  laboratorio: "Laboratório",
  financeiro: "Financeiro",
  general: "Geral",
};

export default function AutomationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // --- Webhooks Tab ---
  const [webhooks, setWebhooks] = useState<WebhookConfig>({
    diretoria: "", comercial: "", operacoes: "", laboratorio: "", financeiro: "",
  });
  const [savingWebhooks, setSavingWebhooks] = useState(false);
  const [testingField, setTestingField] = useState<string | null>(null);

  const { data: webhookConfig } = useQuery({
    queryKey: ["integration_configs", "ms_teams_webhooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_configs")
        .select("*")
        .eq("integration_name", "ms_teams_webhooks")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (webhookConfig?.config) {
      const cfg = webhookConfig.config as any;
      setWebhooks({
        diretoria: cfg.diretoria || "",
        comercial: cfg.comercial || "",
        operacoes: cfg.operacoes || "",
        laboratorio: cfg.laboratorio || "",
        financeiro: cfg.financeiro || "",
      });
    }
  }, [webhookConfig]);

  const saveWebhooks = async () => {
    setSavingWebhooks(true);
    try {
      const payload = {
        integration_name: "ms_teams_webhooks",
        config: webhooks as any,
        updated_by: user?.id || null,
      };
      if (webhookConfig?.id) {
        await supabase.from("integration_configs").update(payload).eq("id", webhookConfig.id);
      } else {
        await supabase.from("integration_configs").insert(payload);
      }
      queryClient.invalidateQueries({ queryKey: ["integration_configs"] });
      toast.success("Webhooks salvos com sucesso!");
    } catch {
      toast.error("Erro ao salvar webhooks");
    } finally {
      setSavingWebhooks(false);
    }
  };

  const testWebhook = async (field: string, url: string) => {
    if (!url) { toast.error("URL vazia"); return; }
    setTestingField(field);
    try {
      // We just validate the URL format since we can't call external URLs from browser due to CORS
      new URL(url);
      toast.success(`URL "${field}" válida! Teste real será feito pelo backend.`);
    } catch {
      toast.error("URL inválida");
    } finally {
      setTestingField(null);
    }
  };

  // --- Autonomy Rules Tab ---
  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["autonomy_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autonomy_rules")
        .select("*")
        .order("domain", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("autonomy_rules")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["autonomy_rules"] }),
    onError: () => toast.error("Erro ao atualizar regra"),
  });

  const groupedRules = rules.reduce((acc, rule) => {
    const d = rule.domain || "general";
    if (!acc[d]) acc[d] = [];
    acc[d].push(rule);
    return acc;
  }, {} as Record<string, typeof rules>);

  const webhookFields = [
    { key: "diretoria", label: "Canal Diretoria (Focus AI)" },
    { key: "comercial", label: "Canal Comercial (Hunter)" },
    { key: "operacoes", label: "Canal Operações (Gear)" },
    { key: "laboratorio", label: "Canal Laboratório (Tracker)" },
    { key: "financeiro", label: "Canal Financeiro (Ledger)" },
  ];

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Regras & MS Teams</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure os webhooks do Microsoft Teams e controle a autonomia dos agentes de IA.
          </p>
        </div>

        <Tabs defaultValue="webhooks">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="w-4 h-4" /> Webhooks do Teams
            </TabsTrigger>
            <TabsTrigger value="autonomia" className="gap-2">
              <Shield className="w-4 h-4" /> Matriz de Autonomia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Webhooks do Microsoft Teams</CardTitle>
                <CardDescription>
                  Cole a URL do Incoming Webhook de cada canal do Teams para que os agentes enviem notificações.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {webhookFields.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://outlook.office.com/webhook/..."
                        value={(webhooks as any)[key]}
                        onChange={(e) => setWebhooks(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testingField === key}
                        onClick={() => testWebhook(key, (webhooks as any)[key])}
                      >
                        {testingField === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                <Button onClick={saveWebhooks} disabled={savingWebhooks} className="mt-4">
                  {savingWebhooks ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Webhooks
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="autonomia" className="mt-6">
            {loadingRules ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : Object.keys(groupedRules).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma regra de autonomia cadastrada. Elas serão criadas automaticamente pelo backend.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedRules).map(([domain, domainRules]) => (
                  <div key={domain}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className={DOMAIN_COLORS[domain] || DOMAIN_COLORS.general}>
                        {DOMAIN_LABELS[domain] || domain}
                      </Badge>
                    </div>
                    <div className="grid gap-3">
                      {domainRules.map((rule) => (
                        <Card key={rule.id} className="bg-card/50">
                          <CardContent className="flex items-center justify-between py-4 px-5">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="font-medium text-sm">{rule.acao}</p>
                              {rule.descricao && (
                                <p className="text-xs text-muted-foreground mt-0.5">{rule.descricao}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="outline" className="text-[10px] h-5">
                                  Nível {rule.nivel}
                                </Badge>
                                {rule.requer_aprovacao && (
                                  <Badge variant="outline" className="text-[10px] h-5 text-amber-400 border-amber-500/30">
                                    Requer Aprovação
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Switch
                              checked={rule.ativo ?? false}
                              onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, ativo: checked })}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
