export type QualityStatus =
  | "aberta"
  | "em_analise"
  | "em_acao"
  | "aguardando_eficacia"
  | "eficaz"
  | "ineficaz"
  | "encerrada"
  | "cancelada";

export type QualityActionType = "contencao" | "corretiva" | "preventiva" | "verificacao";

export interface QualityCase {
  id: string;
  codigo: string;
  metodo: "racp" | "8d";
  titulo: string;
  tipo: "corretiva" | "preventiva" | "ambas";
  origem: string;
  classificacao: string[];
  status: QualityStatus;
  prioridade: "baixa" | "media" | "alta" | "critica";
  risco_nivel: "baixo" | "medio" | "alto" | "critico";
  cliente?: string | null;
  equipamento?: string | null;
  serial_lote?: string | null;
  referencia?: string | null;
  descricao: string;
  impacto?: string | null;
  contencao_imediata?: string | null;
  causa?: string | null;
  criterio_eficacia?: string | null;
  resultado_eficacia?: string | null;
  corretiva_eficaz?: boolean | null;
  preventiva_eficaz?: boolean | null;
  resumo_final?: string | null;
  risco_residual_aceito?: boolean | null;
  data_limite?: string | null;
  data_verificacao?: string | null;
  closed_at?: string | null;
  owner_id?: string | null;
  created_by?: string | null;
  work_order_id?: string | null;
  lab_part_id?: string | null;
  stock_product_id?: string | null;
  stock_movement_id?: string | null;
  commercial_request_id?: string | null;
  contract_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualityAction {
  id: string;
  quality_case_id: string;
  tipo: QualityActionType;
  descricao: string;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  status: "pendente" | "em_andamento" | "concluida" | "atrasada" | "cancelada";
  evidencia?: string | null;
  evidence_urls?: string[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualityEvidence {
  id: string;
  quality_case_id: string;
  action_id?: string | null;
  file_name: string;
  file_url?: string | null;
  file_type?: string | null;
  storage_path?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
  created_at: string;
}

export interface QualityEvent {
  id: string;
  quality_case_id: string;
  event_type: string;
  description?: string | null;
  actor_id?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  created_at: string;
}
