import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, DollarSign, TrendingUp, Users, Target, Bot, Zap, Settings2, ArrowUp, ArrowDown, Filter, X } from "lucide-react";
import { toast } from "sonner";
import AISmartBadge from "@/components/AISmartBadge";
import { Badge } from "@/components/ui/badge";
import { differenceInHours } from "date-fns";
import RequestDetailModal from "@/pages/crm/RequestDetailModal";
import OwnerFilterPopover, { type OwnerQuick, type OwnerOption } from "@/components/crm/OwnerFilterPopover";

const extractRequestId = (notas: string | null | undefined): string | null => {
  if (!notas) return null;
  const m = String(notas).match(/ID solicita[cç][aã]o:\s*([0-9a-f-]{8,})/i);
  return m ? m[1] : null;
};

const DEFAULT_COLUMNS = ["Qualificação", "Contato Inicial", "Reunião", "Proposta Enviada", "Negociação", "Ganho", "Perdido"];

const PROSPECCAO_COLUMNS = [
  "Novo Lead",
  "Tentando Contato",
  "Qualificação",
  "Oportunidade Validada",
  "Reunião Agendada",
  "Apresentar Proposta",
  "Followup para Negociação",
  "Em Negociação",
];

const VENDAS_COLUMNS = [
  "Novo Negócio",
  "Reunião Agendada",
  "Qualificação",
  "Proposta Enviada",
  "Negociação",
  "Negócio Ganho",
];

const SERVICOS_COLUMNS = [
  "Atendimento Inicial",
  "Proposta Enviada",
  "Proposta Aprovada",
  "Faturamento",
  "Negócio Ganho",
  "Interesse Futuro",
];

const HEXA_AI_COLUMNS = [
  "Novo Lead",
  "Qualificação",
  "Orçamento Enviado",
  "Instalando Demo",
  "Demo em Processo",
  "Negociação",
  "Fechamento",
];

const POS_VENDAS_COLUMNS = [
  "Avaliação de Satisfação",
  "Renovação",
  "Up Sell",
  "Cliente em Risco",
  "Cliente Perdido",
];

const COLUMN_COLORS: Record<string, string> = {
  "Qualificação": "border-t-blue-400",
  "Contato Inicial": "border-t-yellow-400",
  "Reunião": "border-t-purple-400",
  "Proposta Enviada": "border-t-orange-400",
  "Negociação": "border-t-teal-400",
  "Ganho": "border-t-green-400",
  "Perdido": "border-t-red-400",
  "Novo Lead": "border-t-sky-400",
  "Tentando Contato": "border-t-yellow-400",
  "Oportunidade Validada": "border-t-indigo-400",
  "Reunião Agendada": "border-t-purple-400",
  "Apresentar Proposta": "border-t-orange-400",
  "Followup para Negociação": "border-t-amber-400",
  "Em Negociação": "border-t-teal-400",
  "Novo Negócio": "border-t-sky-400",
  "Negócio Ganho": "border-t-green-400",
  "Atendimento Inicial": "border-t-blue-400",
  "Proposta Aprovada": "border-t-emerald-400",
  "Faturamento": "border-t-amber-400",
  "Interesse Futuro": "border-t-violet-400",
  "Orçamento Enviado": "border-t-cyan-400",
  "Instalando Demo": "border-t-lime-400",
  "Demo em Processo": "border-t-fuchsia-400",
  "Fechamento": "border-t-green-400",
  "Avaliação de Satisfação": "border-t-emerald-400",
  "Renovação": "border-t-teal-400",
  "Up Sell": "border-t-amber-400",
  "Cliente em Risco": "border-t-orange-400",
  "Cliente Perdido": "border-t-red-400",
};



type FunnelDef = { id: string; label: string; enabled: boolean };

const DEFAULT_FUNNELS: FunnelDef[] = [
  { id: "prospeccao", label: "Funil de Prospecção (MKT)", enabled: true },
  { id: "vendas", label: "Funil de Vendas", enabled: true },
  { id: "servicos", label: "Funil de Serviços", enabled: true },
  { id: "hexa_ai", label: "Hexa AI", enabled: true },
  { id: "pos_vendas", label: "Funil de Pós Vendas", enabled: true },
];

const FUNNELS_STORAGE_KEY = "hexa.kanban.funnels";

export default function KanbanFunnel() {
  const { user, role } = useAuth();
  const canEditRequest = role === "admin" || role === "gestor";
  const [leads, setLeads] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<OwnerOption[]>([]);
  const [requestsById, setRequestsById] = useState<Record<string, any>>({});
  const [activeRequest, setActiveRequest] = useState<{ requestId: string; leadId: string } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [winModalLead, setWinModalLead] = useState<any | null>(null);
  const [funnels, setFunnels] = useState<FunnelDef[]>(() => {
    try {
      const raw = localStorage.getItem(FUNNELS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FunnelDef[];
        // merge with defaults so newly added funnels appear
        const byId = new Map(parsed.map((f) => [f.id, f]));
        return DEFAULT_FUNNELS.map((d) => byId.get(d.id) ?? d).concat(
          parsed.filter((p) => !DEFAULT_FUNNELS.find((d) => d.id === p.id)),
        );
      }
    } catch {}
    return DEFAULT_FUNNELS;
  });
  const [selectedFunnel, setSelectedFunnel] = useState<string>("vendas");
  const [configOpen, setConfigOpen] = useState(false);
  const [ownerQuick, setOwnerQuick] = useState<OwnerQuick>("all");
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("em_andamento");
  const [filterSort, setFilterSort] = useState<string>("recentes");

  const COLUMNS = useMemo(() => {
    if (selectedFunnel === "prospeccao") return PROSPECCAO_COLUMNS;
    if (selectedFunnel === "vendas") return VENDAS_COLUMNS;
    if (selectedFunnel === "servicos") return SERVICOS_COLUMNS;
    if (selectedFunnel === "hexa_ai") return HEXA_AI_COLUMNS;
    if (selectedFunnel === "pos_vendas") return POS_VENDAS_COLUMNS;
    return DEFAULT_COLUMNS;
  }, [selectedFunnel]);



  useEffect(() => {
    localStorage.setItem(FUNNELS_STORAGE_KEY, JSON.stringify(funnels));
  }, [funnels]);

  const activeFunnels = useMemo(() => funnels.filter((f) => f.enabled), [funnels]);

  useEffect(() => {
    if (!activeFunnels.find((f) => f.id === selectedFunnel) && activeFunnels.length) {
      setSelectedFunnel(activeFunnels[0].id);
    }
  }, [activeFunnels, selectedFunnel]);

  useEffect(() => {
    if (!user) return;
    supabase.from("leads").select("*").order("created_at", { ascending: false }).then(async ({ data }) => {
      const list = data || [];
      setLeads(list);
      // Enrich leads originated from commercial_requests
      const ids = Array.from(
        new Set(
          list
            .filter((l: any) => l.origem === "Via Solicitação")
            .map((l: any) => extractRequestId(l.notas))
            .filter((x): x is string => !!x),
        ),
      );
      if (ids.length) {
        const { data: reqs } = await (supabase as any)
          .from("commercial_requests")
          .select("*")
          .in("id", ids);
        const map: Record<string, any> = {};
        (reqs || []).forEach((r: any) => { map[r.id] = r; });
        setRequestsById(map);
      }
    });
    supabase.from("profiles").select("id, nome").order("nome", { ascending: true }).then(({ data }) => {
      setProfiles((data || []).map((p: any) => ({ id: p.id, name: p.nome || "Sem nome" })));
    });
  }, [user]);

  const handleDrop = async (newStatus: string) => {
    if (!draggedId) return;
    const lead = leads.find(l => l.id === draggedId);

    // If moving to "Ganho", show the AI modal
    if (newStatus === "Ganho" && lead?.status !== "Ganho") {
      setWinModalLead(lead);
      // Update locally first
      setLeads(prev => prev.map(l => l.id === draggedId ? { ...l, status: "Ganho" } : l));
      await supabase.from("leads").update({ status: "Ganho" } as any).eq("id", draggedId);
      setDraggedId(null);
      return;
    }

    const { error } = await supabase.from("leads").update({ status: newStatus } as any).eq("id", draggedId);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === draggedId ? { ...l, status: newStatus } : l));
      toast.success(`Lead movido para ${newStatus}`);
    }
    setDraggedId(null);
  };

  const handleAutoGenerate = async () => {
    if (!winModalLead || !user) return;
    // Insert an ai_action_request for Hunter to generate OS + notify
    await supabase.from("ai_action_requests").insert({
      action_type: "generate_os_from_deal",
      domain: "comercial",
      title: `Gerar OS de Instalação para ${winModalLead.nome}`,
      description: `Lead ${winModalLead.nome} (${winModalLead.empresa || ""}) foi marcado como Ganho. Criar OS de instalação e notificar equipe técnica e financeira no MS Teams.`,
      reason: "Lead movido para Ganho no Kanban",
      risk_level: "low",
      status: "pending",
      requires_approval: false,
      estimated_impact: `Valor: R$ ${Number(winModalLead.valor_estimado || 0).toLocaleString("pt-BR")}`,
    } as any);
    toast.success("Hunter notificado! OS de instalação e notificação no Teams serão gerados automaticamente.");
    setWinModalLead(null);
  };

  // Filter leads by selected funnel. Leads without `funil` field default to "vendas".
  // Also hide leads that were soft-deleted (status = "lixeira").
  const filteredLeads = useMemo(() => {
    let list = leads.filter(
      (l) => (l.funil ?? "vendas") === selectedFunnel && l.status !== "lixeira",
    );
    if (ownerQuick === "mine" && user?.id) {
      list = list.filter((l) => l.user_id === user.id);
    } else if (selectedOwners.length > 0) {
      const set = new Set(selectedOwners);
      list = list.filter((l) => l.user_id && set.has(l.user_id));
    }
    return list;
  }, [leads, selectedFunnel, ownerQuick, selectedOwners, user?.id]);

  const handleDeleteLead = async (lead: any) => {
    if (!canEditRequest) return;
    if (!window.confirm(`Mover "${lead.nome || lead.empresa || "este card"}" para a Lixeira?`)) return;
    const prevStatus = lead.status || "";
    const marker = `[TRASH_LEAD_PREV:${prevStatus}|${new Date().toISOString()}]`;
    const newNotas = `${marker}\n${lead.notas || ""}`;
    const { error } = await supabase
      .from("leads")
      .update({ status: "lixeira", notas: newNotas } as any)
      .eq("id", lead.id);
    if (error) {
      toast.error("Erro ao mover para a Lixeira");
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "lixeira", notas: newNotas } : l)));
    toast.success("Card movido para a Lixeira");
  };


  // KPIs
  const totalLeads = filteredLeads.length;
  const totalValue = filteredLeads.reduce((sum, l) => sum + (Number(l.valor_estimado) || 0), 0);
  const wonValue = filteredLeads.filter(l => l.status === "Ganho").reduce((sum, l) => sum + (Number(l.valor_estimado) || 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round((filteredLeads.filter(l => l.status === "Ganho").length / totalLeads) * 100) : 0;

  const moveFunnel = (idx: number, dir: -1 | 1) => {
    setFunnels((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-primary" /> Funil Comercial</h1>
              <p className="text-sm text-muted-foreground">Arraste os cards para atualizar o status</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Selecione o funil" />
                </SelectTrigger>
                <SelectContent>
                  {activeFunnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setConfigOpen(true)}>
                <Settings2 className="w-4 h-4" /> Configurar funis
              </Button>
            </div>
          </div>
          <Link to="/crm"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="w-4 h-4" /> Lista</Button></Link>
        </div>

        {selectedFunnel === "prospeccao" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterDeal} onValueChange={setFilterDeal}>
                <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as negociações</SelectItem>
                  <SelectItem value="minhas">Minhas negociações</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="ganhas">Ganhas</SelectItem>
                  <SelectItem value="perdidas">Perdidas</SelectItem>
                  <SelectItem value="todas">Todas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSort} onValueChange={setFilterSort}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recentes">Criadas por último</SelectItem>
                  <SelectItem value="antigas">Mais antigas</SelectItem>
                  <SelectItem value="valor">Maior valor</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1 h-9">
                <Filter className="w-4 h-4" /> Filtros
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">{filteredLeads.length} Negociações</span>
              {filterStatus !== "todas" && (
                <Badge variant="secondary" className="gap-1">
                  {filterStatus === "em_andamento" ? "Em andamento" : filterStatus === "ganhas" ? "Ganhas" : "Perdidas"}
                  <button onClick={() => setFilterStatus("todas")} className="ml-1 hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}



        {/* Pipeline KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Leads</p>
                <p className="text-lg font-bold">{totalLeads}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-hexa-amber/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-hexa-amber" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline Total</p>
                <p className="text-lg font-bold">R$ {totalValue.toLocaleString("pt-BR")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-hexa-green/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-hexa-green" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ganhos</p>
                <p className="text-lg font-bold text-hexa-green">R$ {wonValue.toLocaleString("pt-BR")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <Target className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversão</p>
                <p className="text-lg font-bold">{conversionRate}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kanban */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colLeads = filteredLeads.filter(l => l.status === col);
            const colValue = colLeads.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);
            return (
              <div
                key={col}
                className={`min-w-[260px] flex-shrink-0 bg-muted/30 rounded-xl border-t-4 ${COLUMN_COLORS[col]} p-3`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{col}</h3>
                  <span className="text-xs bg-muted rounded-full px-2 py-0.5">{colLeads.length}</span>
                </div>
                {colValue > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">R$ {colValue.toLocaleString("pt-BR")}</p>
                )}
                <div className="space-y-2">
                  {colLeads.map(lead => {
                    const lastContact = lead.ultimo_contato || lead.created_at;
                    const hoursInactive = differenceInHours(new Date(), new Date(lastContact));
                    const isInactive = hoursInactive > 72 && !["Ganho", "Perdido"].includes(lead.status);
                    const isFromRequest = lead.origem === "Via Solicitação";
                    const reqId = isFromRequest ? extractRequestId(lead.notas) : null;
                    const req = reqId ? requestsById[reqId] : null;

                    // Summary fields for request-originated cards
                    const clienteOuEmpresa = req ? (req.cpf ? req.cliente_nome : req.empresa) : lead.empresa;
                    const catMarcaModelo = req
                      ? [req.categoria, req.marca, req.modelo].filter(Boolean).join(" • ")
                      : null;
                    const preco = req?.preco != null ? Number(req.preco) : Number(lead.valor_estimado) || 0;

                    const commonInner = (
                      <>
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium truncate">{clienteOuEmpresa || lead.nome}</p>
                          {isInactive && <AISmartBadge agent="Hunter" />}
                        </div>
                        {isFromRequest && catMarcaModelo && (
                          <p className="text-xs text-muted-foreground truncate">{catMarcaModelo}</p>
                        )}
                        {!isFromRequest && lead.empresa && (
                          <p className="text-xs text-muted-foreground">{lead.empresa}</p>
                        )}
                        {isFromRequest && (
                          <Badge variant="secondary" className="mt-1 text-[10px] py-0 px-1.5 bg-emerald-100 text-emerald-800 border-emerald-200">
                            Via Solicitação
                          </Badge>
                        )}
                        {selectedFunnel === "vendas" && lead.status === "Novo Negócio" && (role === "admin" || role === "gestor") && (
                          <Badge variant="outline" className="mt-1 text-[10px] py-0 px-1.5 border-amber-400/60 text-amber-600 bg-amber-50">
                            Pendente aprovação
                          </Badge>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {preco > 0 && (
                            <span className="text-xs text-hexa-green flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              R$ {preco.toLocaleString("pt-BR")}
                            </span>
                          )}
                          {!isFromRequest && lead.origem && (
                            <span className="text-xs text-muted-foreground">{lead.origem}</span>
                          )}
                        </div>
                      </>
                    );

                    if (isFromRequest && reqId) {
                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDraggedId(lead.id)}
                          onDoubleClick={() => setActiveRequest({ requestId: reqId, leadId: lead.id })}
                          title="Duplo clique para ver detalhes da solicitação"
                          className="block p-3 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                        >
                          {commonInner}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={lead.id}
                        to={`/crm/${lead.id}`}
                        draggable
                        onDragStart={() => setDraggedId(lead.id)}
                        className="block p-3 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                      >
                        {commonInner}
                      </Link>
                    );

                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Win Modal — Hunter auto-generate */}
        <Dialog open={!!winModalLead} onOpenChange={(open) => { if (!open) setWinModalLead(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-orange-400" /> Hunter — Contrato Fechado! 🎉
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O lead <strong>{winModalLead?.nome}</strong> foi marcado como <strong>Ganho</strong>.
              </p>
              <p className="text-sm">
                Deseja que a IA (Hunter) gere a <strong>Ordem de Serviço de Instalação</strong> e notifique a equipe técnica e financeira no <strong>MS Teams</strong>?
              </p>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setWinModalLead(null)}>
                Apenas Mover Card
              </Button>
              <Button onClick={handleAutoGenerate} className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                <Zap className="w-4 h-4" /> Gerar Tudo Automático
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Config Funnels Modal */}
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" /> Configurar funis
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {funnels.map((f, idx) => (
                <div key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Switch
                      checked={f.enabled}
                      onCheckedChange={(v) =>
                        setFunnels((prev) => prev.map((x) => (x.id === f.id ? { ...x, enabled: v } : x)))
                      }
                    />
                    <span className="text-sm truncate">{f.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveFunnel(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveFunnel(idx, 1)} disabled={idx === funnels.length - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => { setConfigOpen(false); toast.success("Funis atualizados"); }}>Concluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Detail Modal (for leads originated from commercial_requests) */}
        <RequestDetailModal
          requestId={activeRequest?.requestId || null}
          leadId={activeRequest?.leadId || null}
          open={!!activeRequest}
          onClose={() => setActiveRequest(null)}
          canEdit={canEditRequest}
          onDelete={(leadId) => {
            const lead = leads.find((l) => l.id === leadId);
            if (lead) handleDeleteLead(lead);
            setActiveRequest(null);
          }}
        />
      </div>
    </HexaLayout>
  );
}
