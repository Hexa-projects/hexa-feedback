import { differenceInCalendarDays, format } from "date-fns";
import type { QualityAction, QualityCase, QualityStatus } from "./qualityTypes";

export const STATUS_LABELS: Record<QualityStatus, string> = {
  aberta: "Aberta",
  em_analise: "Em analise",
  em_acao: "Em acao",
  aguardando_eficacia: "Aguardando eficacia",
  eficaz: "Eficaz",
  ineficaz: "Ineficaz",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export const STATUS_OPTIONS: QualityStatus[] = [
  "aberta",
  "em_analise",
  "em_acao",
  "aguardando_eficacia",
  "eficaz",
  "ineficaz",
  "encerrada",
  "cancelada",
];

export const RNC_STATUS_LABELS = {
  aberta: "Aberta",
  em_disposicao: "Em disposicao",
  em_retrabalho: "Em retrabalho",
  em_reinspecao: "Em reinspecao",
  aguardando_racp: "Aguardando RACP",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export const RNC_STATUS_OPTIONS = ["aberta", "em_disposicao", "em_retrabalho", "em_reinspecao", "aguardando_racp", "encerrada", "cancelada"] as const;

export const ORIGENS = ["Cliente", "OS", "Laboratorio", "Estoque", "Fornecedor", "Processo interno", "Auditoria", "Comercial", "Outro"];

export const RNC_ORIGENS = ["Cliente", "Fornecedor", "Recebimento", "Producao", "OS", "Laboratorio", "Estoque", "Auditoria", "Processo interno", "Outro"];

export const RNC_DISPOSICOES = ["Retrabalho", "Reinspecao", "Devolucao ao fornecedor", "Segregar", "Sucata/descarte", "Uso sob concessao", "Aceitar como esta", "Abrir RACP"];

export const RNC_TIPOS = ["Produto", "Servico", "Processo", "Fornecedor", "Documento", "Seguranca", "Garantia", "Outro"];

export const CLASSIFICACOES = [
  "Nao conformidade real",
  "Risco potencial",
  "Reclamacao cliente",
  "Falha em servico",
  "Falha em peca",
  "Desvio de processo",
];

export const IMPACTO_DIMENSOES = ["Cliente", "Equipamento", "Seguranca", "Prazo", "Custo", "Garantia", "Retrabalho", "Compliance", "Imagem"];

export const CAUSA_CATEGORIAS = ["Metodo", "Pessoa", "Maquina", "Material", "Medicao", "Ambiente", "Fornecedor", "Sistema"];

export const ATUALIZACOES_PREVENTIVAS = [
  "Procedimento revisado",
  "Checklist revisado",
  "Treinamento realizado",
  "Estoque/fornecedor ajustado",
  "Plano preventivo atualizado",
  "Base de conhecimento atualizada",
  "Contrato/garantia revisado",
  "Alerta em sistema criado",
];

export const ACTION_TYPE_LABELS = {
  contencao: "Contencao",
  corretiva: "Corretiva",
  preventiva: "Preventiva",
  verificacao: "Verificacao",
};

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export const isCaseOverdue = (item: Pick<QualityCase, "data_limite" | "status">) =>
  Boolean(item.data_limite && !["encerrada", "eficaz", "cancelada"].includes(item.status) && differenceInCalendarDays(new Date(item.data_limite), new Date()) < 0);

export const isActionOverdue = (item: Pick<QualityAction, "due_date" | "status">) =>
  Boolean(item.due_date && !["concluida", "cancelada"].includes(item.status) && differenceInCalendarDays(new Date(item.due_date), new Date()) < 0);

export const statusBadgeClass = (status: QualityStatus, overdue = false) => {
  if (overdue || status === "ineficaz" || status === "cancelada") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (status === "eficaz" || status === "encerrada") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (status === "em_acao" || status === "aguardando_eficacia") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
};

export const rncStatusBadgeClass = (status: string) => {
  if (status === "encerrada") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (status === "cancelada") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (status === "aguardando_racp" || status === "em_reinspecao") return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
  if (status === "em_disposicao" || status === "em_retrabalho") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
};

export const priorityBadgeClass = (prioridade?: string) => {
  if (prioridade === "critica") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (prioridade === "alta") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
  if (prioridade === "media") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
};

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return format(new Date(value), "dd/MM/yyyy");
};

export const buildQualityLinkParams = (source: Record<string, string | null | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(source).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `/quality/cases/new?${params.toString()}`;
};
