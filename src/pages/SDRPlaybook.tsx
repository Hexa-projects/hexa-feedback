import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target, Zap, MessageSquare, Phone, Clock, CheckCircle2,
  AlertTriangle, ArrowRight, Bot, Users, BarChart3, Rocket
} from "lucide-react";

const FUNNEL_STEPS = [
  {
    stage: "Qualificação",
    color: "bg-blue-500",
    goal: "Confirmar que o lead é ICP (perfil ideal)",
    actions: [
      "Verificar CNPJ, segmento, faturamento estimado",
      "Pesquisar LinkedIn do decisor",
      "Classificar como MQL se atender critérios",
    ],
    prompt: `Analise o lead {nome} da empresa {empresa}. Com base no segmento e porte, ele se encaixa no nosso ICP? Liste pontos fortes e fracos para qualificação.`,
    sla: "24h para qualificar",
  },
  {
    stage: "Contato Inicial",
    color: "bg-yellow-500",
    goal: "Primeiro toque — despertar interesse",
    actions: [
      "Enviar mensagem personalizada via WhatsApp",
      "Follow-up por e-mail se sem resposta em 4h",
      "Registrar interação no CRM",
    ],
    prompt: `Gere uma mensagem de primeiro contato para {nome} ({cargo}) da {empresa}. Tom: consultivo, não vendedor. Foque no problema que resolvemos para o segmento dele.`,
    sla: "4h para primeiro contato",
  },
  {
    stage: "Reunião",
    color: "bg-purple-500",
    goal: "Descobrir dores e apresentar solução",
    actions: [
      "Agendar call via LiveKit (30 min)",
      "Preparar deck personalizado",
      "AI Agent participa para transcrever e gerar tarefas",
    ],
    prompt: `Prepare um briefing de 3 parágrafos para a reunião com {nome} ({empresa}). Inclua: contexto do mercado dele, possíveis dores, e como nossa solução se conecta.`,
    sla: "48h para agendar",
  },
  {
    stage: "Proposta Enviada",
    color: "bg-orange-500",
    goal: "Apresentar proposta comercial clara",
    actions: [
      "Gerar proposta no módulo CRM",
      "Enviar via WhatsApp + e-mail",
      "Agendar follow-up 48h após envio",
    ],
    prompt: `Resuma os pontos-chave da proposta para {nome}. Destaque: ROI estimado, diferencial competitivo e urgência para fechar este mês.`,
    sla: "24h após reunião",
  },
  {
    stage: "Negociação",
    color: "bg-teal-500",
    goal: "Resolver objeções e fechar",
    actions: [
      "Identificar objeções e preparar respostas",
      "Se necessário, oferecer condição especial",
      "Focus AI monitora SLA e dispara alertas",
    ],
    prompt: `O lead {nome} levantou a objeção: "{objecao}". Gere 3 argumentos de contorno, mantendo tom consultivo. Inclua caso de sucesso similar se possível.`,
    sla: "Responder objeções em 12h",
  },
];

const AUTOMATIONS = [
  {
    trigger: "Lead sem resposta há 48h",
    action: "Focus AI envia follow-up automático via WhatsApp",
    channel: "#alertas-ia",
    icon: Clock,
  },
  {
    trigger: "Reunião encerrada no LiveKit",
    action: "AI transcreve, gera resumo e cria tarefas no canal #status",
    channel: "#status",
    icon: Bot,
  },
  {
    trigger: "Proposta enviada há 72h sem resposta",
    action: "Alerta no canal #leads + notificação para SDR responsável",
    channel: "#leads",
    icon: AlertTriangle,
  },
  {
    trigger: "Lead qualificado com valor > R$ 10k",
    action: "Notificação prioritária + sugestão de ação do Focus AI",
    channel: "#alertas-ia",
    icon: Zap,
  },
  {
    trigger: "Novo lead via Webhook/WhatsApp",
    action: "Criado automaticamente no CRM + classificação por IA",
    channel: "#leads",
    icon: Users,
  },
];

const IMPLEMENTATION_STEPS = [
  { step: 1, title: "Configurar equipe", desc: "Cadastre SDRs no HexaOS, atribua role 'colaborador' e setor 'Comercial'" },
  { step: 2, title: "Criar canais no Teams", desc: "Crie os canais #leads, #status e #alertas-ia no módulo Teams Interno" },
  { step: 3, title: "Importar base de leads", desc: "Use o módulo CRM > Novo Lead ou importe via planilha" },
  { step: 4, title: "Configurar WhatsApp", desc: "Em Configurações > Integrações, conecte a Evolution API para disparos" },
  { step: 5, title: "Ativar Focus AI", desc: "Em IA & Automação > Focus AI, configure regras de autonomia e gatilhos" },
  { step: 6, title: "Definir SLAs", desc: "Configure alertas automáticos para leads sem contato (24h, 48h, 72h)" },
  { step: 7, title: "Treinar equipe", desc: "Compartilhe este Playbook e faça onboarding prático de 30 min" },
  { step: 8, title: "Monitorar métricas", desc: "Acompanhe pipeline, conversão e SLA no Dashboard SDR diariamente" },
];

export default function SDRPlaybook() {
  return (
    <HexaLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" /> Playbook SDR
          </h1>
          <p className="text-sm text-muted-foreground">
            Guia completo de operação SDR com automações Focus AI
          </p>
        </div>

        <Tabs defaultValue="funil" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="funil">Funil & Prompts</TabsTrigger>
            <TabsTrigger value="automacoes">Automações</TabsTrigger>
            <TabsTrigger value="implantacao">Implantação</TabsTrigger>
          </TabsList>

          {/* Funil Tab */}
          <TabsContent value="funil" className="space-y-4">
            {FUNNEL_STEPS.map((step, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${step.color} flex items-center justify-center text-white text-sm font-bold`}>
                      {i + 1}
                    </div>
                    <div>
                      <CardTitle className="text-base">{step.stage}</CardTitle>
                      <p className="text-xs text-muted-foreground">{step.goal}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-xs">
                      <Clock className="w-3 h-3 mr-1" /> {step.sla}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Ações do SDR</p>
                    <ul className="space-y-1">
                      {step.actions.map((a, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Bot className="w-3 h-3" /> Prompt Focus AI
                    </p>
                    <p className="text-sm font-mono text-foreground/80">{step.prompt}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Automações Tab */}
          <TabsContent value="automacoes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Gatilhos Automáticos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {AUTOMATIONS.map((auto, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <auto.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{auto.trigger}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <ArrowRight className="w-3 h-3 inline mr-1" />{auto.action}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      <MessageSquare className="w-3 h-3 mr-1" />{auto.channel}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Canais Teams Essenciais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {[
                    { name: "#leads", desc: "Novos leads, movimentações no funil, atualizações" },
                    { name: "#status", desc: "Resumos diários, métricas, resultados de reuniões" },
                    { name: "#alertas-ia", desc: "Insights e alertas automáticos do Focus AI" },
                  ].map(ch => (
                    <div key={ch.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Badge className="bg-primary/10 text-primary border-0 font-mono">{ch.name}</Badge>
                      <p className="text-sm text-muted-foreground">{ch.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Implantação Tab */}
          <TabsContent value="implantacao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Passo a Passo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {IMPLEMENTATION_STEPS.map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                        {s.step}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métricas para Acompanhar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { metric: "Leads Ativos", target: "Manter >20 no funil" },
                    { metric: "Taxa de Conversão", target: ">15% do total" },
                    { metric: "Tempo de Follow-up", target: "<24h médio" },
                    { metric: "SLA em Risco", target: "0 leads >48h sem contato" },
                    { metric: "Taxa de Resposta", target: ">60% dos leads" },
                    { metric: "Pipeline Total", target: "3x a meta mensal" },
                  ].map(m => (
                    <div key={m.metric} className="p-3 rounded-lg border">
                      <p className="text-sm font-medium">{m.metric}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Target className="w-3 h-3" /> {m.target}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
