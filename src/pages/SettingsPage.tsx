import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Users, KeyRound, FileText, Zap, Plug, Settings2,
  Plus, Trash2, Edit2, Save, X, UserCheck, UserX, RefreshCw,
  Mail, MessageSquare, Calendar, Check, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──

interface UserProfile {
  id: string;
  nome: string;
  setor: string;
  funcao: string;
  onboarding_completo: boolean;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "gestor" | "colaborador";
}

interface UserWithRole extends UserProfile {
  role: "admin" | "gestor" | "colaborador";
  email?: string;
}

// ── Constants ──

const SETORES = ["Comercial", "Técnico", "Laboratório", "Administrativo", "Financeiro", "Logística", "Diretoria"];
const ROLES: Array<"admin" | "gestor" | "colaborador"> = ["admin", "gestor", "colaborador"];
const ROLE_LABELS: Record<string, string> = { admin: "Administrador", gestor: "Gestor", colaborador: "Colaborador" };
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  gestor: "bg-amber-500/10 text-amber-600",
  colaborador: "bg-primary/10 text-primary",
};

const MODULES = [
  { key: "home", label: "Home" },
  { key: "crm", label: "CRM & Vendas" },
  { key: "projects", label: "Projetos & Implantação" },
  { key: "os", label: "Manutenção & OS" },
  { key: "lab", label: "Laboratório" },
  { key: "finance", label: "Financeiro" },
  { key: "reports", label: "Relatórios" },
  { key: "chat", label: "Chat IA" },
  { key: "channels", label: "Canal Corporativo" },
  { key: "focus_ai", label: "Focus AI" },
  { key: "settings", label: "Configurações" },
];

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: Object.fromEntries(MODULES.map(m => [m.key, true])),
  gestor: { home: true, crm: true, projects: true, os: true, lab: true, finance: false, reports: true, chat: true, channels: true, focus_ai: false, settings: false },
  colaborador: { home: true, crm: true, projects: false, os: true, lab: true, finance: false, reports: true, chat: true, channels: true, focus_ai: false, settings: false },
};

// ── Component ──

export default function SettingsPage() {
  const { user, role } = useAuth();

  if (role !== "admin") {
    return (
      <HexaLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground text-sm">Apenas administradores podem acessar as configurações.</p>
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
            <Settings2 className="w-6 h-6 text-primary" /> Configurações
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie usuários, permissões, templates e integrações.</p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid grid-cols-3 lg:grid-cols-5 h-auto">
            <TabsTrigger value="users" className="text-xs gap-1"><Users className="w-3 h-3" />Usuários</TabsTrigger>
            <TabsTrigger value="permissions" className="text-xs gap-1"><KeyRound className="w-3 h-3" />Permissões</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs gap-1"><FileText className="w-3 h-3" />Templates</TabsTrigger>
            <TabsTrigger value="automations" className="text-xs gap-1"><Zap className="w-3 h-3" />Automações</TabsTrigger>
            <TabsTrigger value="integrations" className="text-xs gap-1"><Plug className="w-3 h-3" />Integrações</TabsTrigger>
          </TabsList>

          <TabsContent value="users"><UsersTab currentUserId={user?.id || ""} /></TabsContent>
          <TabsContent value="permissions"><PermissionsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="automations"><AutomationsTab /></TabsContent>
          <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}

// ═══════════════════════════════════════════════════
// TAB: Users
// ═══════════════════════════════════════════════════

function UsersTab({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "gestor" | "colaborador">("colaborador");
  const [editSetor, setEditSetor] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("user_roles").select("*"),
    ]);

    const profiles = (profilesRes.data || []) as UserProfile[];
    const roles = (rolesRes.data || []) as UserRole[];
    const roleMap = new Map(roles.map(r => [r.user_id, r.role]));

    const merged: UserWithRole[] = profiles.map(p => ({
      ...p,
      role: roleMap.get(p.id) || "colaborador",
    }));
    setUsers(merged);
    setLoading(false);
  };

  const startEdit = (u: UserWithRole) => {
    setEditingId(u.id);
    setEditRole(u.role);
    setEditSetor(u.setor);
  };

  const saveEdit = async (userId: string) => {
    // Update role
    const existing = await supabase.from("user_roles").select("id").eq("user_id", userId).single();
    if (existing.data) {
      await supabase.from("user_roles").update({ role: editRole }).eq("user_id", userId);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: editRole });
    }

    // Update setor
    await supabase.from("profiles").update({ setor: editSetor }).eq("id", userId);

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: editRole, setor: editSetor } : u));
    setEditingId(null);
    toast.success("Usuário atualizado");
  };

  const filtered = users.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.setor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" /> Usuários</CardTitle>
        <CardDescription>Gerencie todos os usuários da plataforma.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar por nome ou setor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {/* Summary */}
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Total: <strong>{users.length}</strong></span>
          <span className="text-muted-foreground">Admins: <strong>{users.filter(u => u.role === "admin").length}</strong></span>
          <span className="text-muted-foreground">Gestores: <strong>{users.filter(u => u.role === "gestor").length}</strong></span>
          <span className="text-muted-foreground">Onboarding pendente: <strong>{users.filter(u => !u.onboarding_completo).length}</strong></span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Setor</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Função</th>
                  <th className="text-left p-3 font-medium">Perfil</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Status</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{u.nome}</span>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {editingId === u.id ? (
                        <select
                          className="text-xs border rounded px-2 py-1 bg-background"
                          value={editSetor}
                          onChange={e => setEditSetor(e.target.value)}
                        >
                          {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">{u.setor}</span>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{u.funcao || "—"}</td>
                    <td className="p-3">
                      {editingId === u.id ? (
                        <select
                          className="text-xs border rounded px-2 py-1 bg-background"
                          value={editRole}
                          onChange={e => setEditRole(e.target.value as any)}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        <Badge variant="outline" className={`text-xs ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {u.onboarding_completo ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">
                          <UserCheck className="w-3 h-3 mr-1" /> Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Pendente
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {editingId === u.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => saveEdit(u.id)} className="h-7 w-7 p-0">
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 w-7 p-0">
                            <X className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(u)}
                          disabled={u.id === currentUserId}
                          className="h-7 w-7 p-0"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// TAB: Permissions
// ═══════════════════════════════════════════════════

function PermissionsTab() {
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><KeyRound className="w-5 h-5" /> Perfis e Permissões</CardTitle>
        <CardDescription>Configure o acesso por módulo para cada perfil. As permissões são aplicadas via Supabase RLS.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Módulo</th>
                {ROLES.map(r => (
                  <th key={r} className="text-center p-3 font-medium">{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(mod => (
                <tr key={mod.key} className="border-t">
                  <td className="p-3 font-medium">{mod.label}</td>
                  {ROLES.map(r => (
                    <td key={r} className="p-3 text-center">
                      <Switch
                        checked={permissions[r]?.[mod.key] ?? false}
                        onCheckedChange={v => {
                          setPermissions(prev => ({
                            ...prev,
                            [r]: { ...prev[r], [mod.key]: v },
                          }));
                        }}
                        disabled={r === "admin"}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={() => toast.success("Permissões salvas (visual). RLS já aplicado no banco.")} className="gap-2">
            <Save className="w-4 h-4" /> Salvar Permissões
          </Button>
          <p className="text-xs text-muted-foreground">As permissões reais são controladas via RLS no Supabase.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// TAB: Templates
// ═══════════════════════════════════════════════════

interface Template {
  id: string;
  nome: string;
  tipo: string;
  conteudo: string;
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: "1",
      nome: "Proposta Comercial Padrão",
      tipo: "proposta",
      conteudo: "Prezado(a) {{cliente.nome}},\n\nApresentamos nossa proposta para {{proposta.titulo}} no valor de R$ {{proposta.valor}}.\n\nCondições:\n- Validade: {{proposta.validade}} dias\n- Pagamento: conforme negociação\n\nAtenciosamente,\n{{empresa.nome}}",
    },
    {
      id: "2",
      nome: "Contrato de Manutenção",
      tipo: "contrato",
      conteudo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MANUTENÇÃO\n\nContratante: {{cliente.nome}}\nCNPJ: {{cliente.cnpj}}\n\nObjeto: Serviços de manutenção preventiva e corretiva em {{contrato.equipamentos}}.\n\nVigência: {{contrato.inicio}} a {{contrato.fim}}\nValor mensal: R$ {{contrato.valor_mensal}}",
    },
    {
      id: "3",
      nome: "Relatório de OS",
      tipo: "relatorio",
      conteudo: "RELATÓRIO DE ORDEM DE SERVIÇO\n\nOS Nº: {{os.numero}}\nCliente: {{os.cliente}}\nEquipamento: {{os.equipamento}}\nDescrição: {{os.descricao}}\n\nAtividades realizadas:\n{{os.atividades}}\n\nTempo total: {{os.tempo_gasto}} min\nTécnico: {{os.tecnico}}",
    },
  ]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Template>>({});

  const startEdit = (t: Template) => {
    setEditing(t.id);
    setEditData({ nome: t.nome, tipo: t.tipo, conteudo: t.conteudo });
  };

  const saveEdit = (id: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...editData } : t));
    setEditing(null);
    toast.success("Template atualizado");
  };

  const addTemplate = () => {
    const newT: Template = {
      id: crypto.randomUUID(),
      nome: "Novo Template",
      tipo: "proposta",
      conteudo: "{{placeholder}}",
    };
    setTemplates(prev => [...prev, newT]);
    startEdit(newT);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Template removido");
  };

  const TIPO_LABELS: Record<string, string> = {
    proposta: "Proposta",
    contrato: "Contrato",
    relatorio: "Relatório",
    email: "E-mail",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Templates</CardTitle>
            <CardDescription>Modelos de propostas, contratos e relatórios com placeholders dinâmicos.</CardDescription>
          </div>
          <Button onClick={addTemplate} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> Novo Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <strong>Placeholders disponíveis:</strong> {"{{cliente.nome}}, {{proposta.titulo}}, {{proposta.valor}}, {{os.numero}}, {{os.cliente}}, {{os.equipamento}}, {{empresa.nome}}"}
        </div>

        {templates.map(t => (
          <Card key={t.id} className="border">
            <CardContent className="p-4 space-y-3">
              {editing === t.id ? (
                <>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input value={editData.nome || ""} onChange={e => setEditData({ ...editData, nome: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={editData.tipo || "proposta"}
                        onChange={e => setEditData({ ...editData, tipo: e.target.value })}
                      >
                        {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Conteúdo</Label>
                    <Textarea rows={8} value={editData.conteudo || ""} onChange={e => setEditData({ ...editData, conteudo: e.target.value })} className="font-mono text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(t.id)} className="gap-1"><Save className="w-3 h-3" /> Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{t.nome}</span>
                      <Badge variant="outline" className="text-xs">{TIPO_LABELS[t.tipo] || t.tipo}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(t)} className="h-7 w-7 p-0">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)} className="h-7 w-7 p-0 text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">{t.conteudo}</pre>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// TAB: Automations
// ═══════════════════════════════════════════════════

interface Automation {
  id: string;
  nome: string;
  gatilho: string;
  condicao: string;
  acao: string;
  ativo: boolean;
}

function AutomationsTab() {
  const [automations, setAutomations] = useState<Automation[]>([
    { id: "1", nome: "Alerta de SLA crítico", gatilho: "OS sem atualização > 24h", condicao: "urgencia = Crítica", acao: "Enviar alerta via Focus AI", ativo: true },
    { id: "2", nome: "Follow-up de lead", gatilho: "Lead sem contato > 3 dias", condicao: "status = Contato Inicial", acao: "Criar tarefa de follow-up", ativo: true },
    { id: "3", nome: "Resumo diário de gargalos", gatilho: "Cron diário 08:00", condicao: "Sempre", acao: "Gerar resumo via Focus AI", ativo: false },
    { id: "4", nome: "Notificação de proposta expirada", gatilho: "Proposta expirada", condicao: "validade < hoje", acao: "Enviar e-mail ao responsável", ativo: true },
  ]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Automation>>({});

  const toggle = (id: string) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a));
    toast.success("Automação atualizada");
  };

  const startEdit = (a: Automation) => {
    setEditing(a.id);
    setEditData({ nome: a.nome, gatilho: a.gatilho, condicao: a.condicao, acao: a.acao });
  };

  const saveEdit = (id: string) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...editData } : a));
    setEditing(null);
    toast.success("Automação salva");
  };

  const addAutomation = () => {
    const newA: Automation = {
      id: crypto.randomUUID(),
      nome: "Nova Automação",
      gatilho: "",
      condicao: "",
      acao: "",
      ativo: false,
    };
    setAutomations(prev => [...prev, newA]);
    startEdit(newA);
  };

  const deleteAutomation = (id: string) => {
    setAutomations(prev => prev.filter(a => a.id !== id));
    toast.success("Automação removida");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Zap className="w-5 h-5" /> Automações</CardTitle>
            <CardDescription>Configure gatilhos, condições e ações automáticas via OpenClaw.</CardDescription>
          </div>
          <Button onClick={addAutomation} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> Nova Automação
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {automations.map(a => (
          <Card key={a.id} className={`border transition-opacity ${!a.ativo ? "opacity-60" : ""}`}>
            <CardContent className="p-4">
              {editing === a.id ? (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input value={editData.nome || ""} onChange={e => setEditData({ ...editData, nome: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gatilho</Label>
                      <Input value={editData.gatilho || ""} onChange={e => setEditData({ ...editData, gatilho: e.target.value })} placeholder="Ex: OS sem atualização > 24h" />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Condição</Label>
                      <Input value={editData.condicao || ""} onChange={e => setEditData({ ...editData, condicao: e.target.value })} placeholder="Ex: urgencia = Crítica" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ação</Label>
                      <Input value={editData.acao || ""} onChange={e => setEditData({ ...editData, acao: e.target.value })} placeholder="Ex: Enviar alerta via Focus AI" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(a.id)} className="gap-1"><Save className="w-3 h-3" /> Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-4 h-4 ${a.ativo ? "text-amber-500" : "text-muted-foreground"}`} />
                      <span className="font-medium text-sm">{a.nome}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>🎯 {a.gatilho}</span>
                      <span>📋 {a.condicao}</span>
                      <span>⚡ {a.acao}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={a.ativo} onCheckedChange={() => toggle(a.id)} />
                    <Button size="sm" variant="ghost" onClick={() => startEdit(a)} className="h-7 w-7 p-0">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteAutomation(a.id)} className="h-7 w-7 p-0 text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// TAB: Integrations
// ═══════════════════════════════════════════════════

function IntegrationsTab() {
  const [waStatus, setWaStatus] = useState<{ connected: boolean; state?: string; reason?: string } | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waLogs, setWaLogs] = useState<any[]>([]);

  const checkWhatsAppStatus = async () => {
    setWaLoading(true);
    try {
      const { data } = await supabase.functions.invoke("whatsapp-service", { body: { action: "status" } });
      setWaStatus(data);
    } catch {
      setWaStatus({ connected: false, reason: "Erro ao verificar" });
    }
    setWaLoading(false);
  };

  const connectWhatsApp = async () => {
    setWaLoading(true);
    try {
      const { data } = await supabase.functions.invoke("whatsapp-service", { body: { action: "connect" } });
      if (data?.qr) {
        toast.info("QR Code gerado — verifique os logs da função para parear");
      }
      await checkWhatsAppStatus();
    } catch {
      toast.error("Erro ao conectar WhatsApp");
    }
    setWaLoading(false);
  };

  const loadLogs = async () => {
    const { data } = await supabase.from("whatsapp_logs").select("*").order("created_at", { ascending: false }).limit(10);
    setWaLogs(data || []);
  };

  useEffect(() => {
    checkWhatsAppStatus();
    loadLogs();
  }, []);

  const integrations = [
    {
      nome: "E-mail SMTP",
      descricao: "Envio de e-mails transacionais para propostas, contratos e notificações.",
      icon: Mail,
      status: "pendente" as const,
      config: ["Host SMTP", "Porta", "Usuário", "Senha", "E-mail remetente"],
    },
    {
      nome: "Calendário Técnico",
      descricao: "Sincronização de agendas de manutenção e visitas técnicas.",
      icon: Calendar,
      status: "pendente" as const,
      config: ["Provedor (Google/Outlook)", "Client ID", "Client Secret"],
    },
    {
      nome: "OpenClaw Gateway",
      descricao: "Motor de IA e automação inteligente (Focus AI).",
      icon: Zap,
      status: "ativo" as const,
      config: ["URL", "Token", "Ambiente"],
    },
  ];

  const STATUS_BADGE: Record<string, string> = {
    ativo: "bg-green-500/10 text-green-600",
    pendente: "bg-amber-500/10 text-amber-600",
    erro: "bg-destructive/10 text-destructive",
  };

  const STATUS_LABEL: Record<string, string> = {
    ativo: "Conectado",
    pendente: "Pendente",
    erro: "Erro",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Plug className="w-5 h-5" /> Integrações</CardTitle>
        <CardDescription>Conecte o HexaOS a serviços externos para automação e comunicação.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* WhatsApp Evolution API Card */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">WhatsApp (Evolution API)</span>
                    <Badge variant="outline" className={`text-xs ${waStatus?.connected ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                      {waLoading ? "Verificando..." : waStatus?.connected ? "Conectado" : waStatus?.reason || "Desconectado"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Envio automático de resumos, alertas e comunicados via WhatsApp pelo Focus AI.
                  </p>
                  {waStatus && !waStatus.connected && waStatus.state && (
                    <p className="text-xs text-muted-foreground mt-1">Estado: {waStatus.state}</p>
                  )}
                  {waLogs.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Últimos envios:</p>
                      {waLogs.slice(0, 5).map(log => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className={`text-[10px] ${log.status === "sent" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                            {log.status}
                          </Badge>
                          <span className="text-muted-foreground truncate max-w-[200px]">{log.destinatario_nome || log.destinatario}</span>
                          <span className="text-muted-foreground truncate max-w-[200px]">{log.mensagem.substring(0, 50)}...</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={checkWhatsAppStatus} disabled={waLoading}>
                  <RefreshCw className={`w-3.5 h-3.5 ${waLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button size="sm" onClick={connectWhatsApp} disabled={waLoading}>
                  {waStatus?.connected ? "Reconectar" : "Conectar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {integrations.map(int => (
          <Card key={int.nome} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <int.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{int.nome}</span>
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[int.status]}`}>
                        {STATUS_LABEL[int.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{int.descricao}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {int.config.map(c => (
                        <Badge key={c} variant="outline" className="text-xs font-normal">{c}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={int.status === "ativo" ? "outline" : "default"}
                  onClick={() => {
                    if (int.status === "ativo") {
                      toast.info("Use a aba Focus AI para gerenciar o OpenClaw");
                    } else {
                      toast.info(`Configuração de ${int.nome} será habilitada em breve`);
                    }
                  }}
                >
                  {int.status === "ativo" ? "Gerenciar" : "Configurar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
