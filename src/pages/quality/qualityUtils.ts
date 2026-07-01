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

export const ORIGENS = ["Cliente", "OS", "Laboratorio", "Estoque", "Fornecedor", "Processo interno", "Auditoria", "Comercial", "Outro"];

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
