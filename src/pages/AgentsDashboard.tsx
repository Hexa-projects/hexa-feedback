import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bot, Shield, Settings2, Activity, Brain, Save, RefreshCw,
  TrendingUp, Users, DollarSign, Wrench, HeartPulse, Megaphone,
  BarChart3, Scale, FlaskConical, Crown
} from "lucide-react";
import { toast } from "sonner";

interface Agent {
  id: string;
  nome: string;
  domain: string;
  descricao: string;
  system_prompt: string;
  modelo: string;
  ativo: boolean;
  metricas: any;
  fontes_autorizadas: string[];
}

const DOMAIN_ICONS: Record<string, any> = {
  executive: Crown, sales: TrendingUp, finance: DollarSign,
  ops: Wrench, hr: Users, support: HeartPulse,
  marketing: Megaphone, data: BarChart3, lab: FlaskConical,
  legal: Scale, general: Bot,
};

const DOMAIN_LABELS: Record<string, string> = {
  executive: "Executivo", sales: "Vendas", finance: "Financeiro",
  ops: "Operações", hr: "RH/People", support: "Suporte",
  marketing: "Marketing", data: "Data/BI", lab: "Laboratório",
  legal: "Jurídico", general: "Geral",
};

export default function AgentsDashboard() {
  const { role } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Agent>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    const { data } = await supabase.from("ai_agents" as any).select("*").order("nome");
    setAgents((data || []) as unknown as Agent[]);
    setLoading(false);
  };

  const toggleAgent = async (agent: Agent) => {
    await supabase.from("ai_agents" as any).update({ ativo: !agent.ativo } as any).eq("id", agent.id);
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, ativo: !a.ativo } : a));
    toast.success(`${agent.nome} ${!agent.ativo ? "ativado" : "desativado"}`);
  };

  const startEdit = (agent: Agent) => {
    setEditing(agent.id);
    setEditData({ system_prompt: agent.system_prompt, modelo: agent.modelo, descricao: agent.descricao });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    await supabase.from("ai_agents" as any).update(editData as any).eq("id", id);
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...editData } : a));
    setEditing(null);
    setSaving(false);
    toast.success("Agente atualizado");
  };

  if (role !== "admin") {
    return (
      <HexaLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground text-sm">Apenas administradores podem gerenciar agentes.</p>
            </CardContent>
          </Card>
        </div>
      </HexaLayout>
    );
  }

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" /> Agentes IA
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie os agentes especializados por setor.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-xs text-muted-foreground">Total de Agentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.filter(a => a.ativo).length}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent cards */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(agent => {
            const Icon = DOMAIN_ICONS[agent.domain] || Bot;
            const isEditing = editing === agent.id;

            return (
              <Card key={agent.id} className={`transition-all ${!agent.ativo ? "opacity-60" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{agent.nome}</CardTitle>
                        <Badge variant="outline" className="text-xs mt-0.5">
                          {DOMAIN_LABELS[agent.domain] || agent.domain}
                        </Badge>
                      </div>
                    </div>
                    <Switch checked={agent.ativo} onCheckedChange={() => toggleAgent(agent)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">Descrição</Label>
                        <Input
                          value={editData.descricao || ""}
                          onChange={e => setEditData({ ...editData, descricao: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">System Prompt</Label>
                        <Textarea
                          rows={4}
                          value={editData.system_prompt || ""}
                          onChange={e => setEditData({ ...editData, system_prompt: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Modelo</Label>
                        <Input
                          value={editData.modelo || ""}
                          onChange={e => setEditData({ ...editData, modelo: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(agent.id)} disabled={saving} className="gap-1">
                          <Save className="w-3 h-3" /> Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{agent.descricao}</p>
                      <p className="text-xs text-muted-foreground/70">Modelo: {agent.modelo}</p>
                      <Button size="sm" variant="outline" onClick={() => startEdit(agent)} className="gap-1">
                        <Settings2 className="w-3 h-3" /> Configurar
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </HexaLayout>
  );
}
