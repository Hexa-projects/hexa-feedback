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
  data_ocorrencia?: string | null;
  data_deteccao?: string | null;
  local_deteccao?: string | null;
  detectado_por?: string | null;
  evidencia_inicial?: string | null;
  impacto?: string | null;
  impacto_dimensoes?: string[];
  impacto_observacoes?: Record<string, string> | null;
  contencao_imediata?: string | null;
  contencao_realizada_em?: string | null;
  contencao_responsavel?: string | null;
  causa?: string | null;
  causa_status?: "nao_iniciada" | "provavel" | "confirmada" | "descartada";
  causa_categoria?: string | null;
  causa_evidencias?: string | null;
  cinco_porques?: Array<{ pergunta: string; resposta: string; evidencia?: string }>;
  causas_descartadas?: string | null;
  objetivo_corretivo?: string | null;
  objetivo_preventivo?: string | null;
  abrangencia_preventiva?: string | null;
  criterio_eficacia?: string | null;
  resultado_eficacia?: string | null;
  corretiva_eficaz?: boolean | null;
  preventiva_eficaz?: boolean | null;
  atualizacoes_preventivas?: string[];
  licoes_aprendidas?: string | null;
  resumo_final?: string | null;
  risco_residual_aceito?: boolean | null;
  nova_racp_necessaria?: boolean | null;
  nova_racp_motivo?: string | null;
  aprovacao_qualidade_status?: "pendente" | "aprovado" | "reprovado" | "dispensado";
  aprovacao_qualidade_por?: string | null;
  aprovacao_qualidade_em?: string | null;
  aprovacao_area_status?: "pendente" | "aprovado" | "reprovado" | "dispensado";
  aprovacao_area_por?: string | null;
  aprovacao_area_em?: string | null;
  versao?: number;
  revisao_motivo?: string | null;
  documento_relacionado?: string | null;
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
  realizada_em?: string | null;
  status: "pendente" | "em_andamento" | "concluida" | "atrasada" | "cancelada";
  evidencia?: string | null;
  evidence_urls?: string[];
  custo?: number | null;
  abrangencia?: string | null;
  resultado?: string | null;
  validado_por?: string | null;
  validado_em?: string | null;
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
