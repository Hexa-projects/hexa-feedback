export const SETORES = [
  "Comercial", "Técnico", "Laboratório", "Administrativo",
  "Financeiro", "Logística", "Diretoria"
] as const;

export type Setor = typeof SETORES[number];

export const FERRAMENTAS = [
  "Excel", "WhatsApp", "E-mail", "ERP", "Google Sheets",
  "Telefone", "Sistema interno", "Planilha física", "Outro"
] as const;

export const FREQUENCIAS = ["Diário", "Semanal", "Mensal", "Eventual"] as const;
export const URGENCIAS = ["Baixa", "Média", "Alta", "Crítica"] as const;
export const IMPACTOS = ["Tempo", "Dinheiro", "Retrabalho", "Cliente", "Erro técnico"] as const;
export const BENEFICIOS = ["Tempo", "Custo", "Qualidade", "Receita", "Satisfação"] as const;
export const ESFORCOS = ["Baixo", "Médio", "Alto"] as const;

export const CATEGORIAS_FERRAMENTA = [
  "Planilha / Excel", "Sistema / ERP", "WhatsApp / Mensageiro",
  "E-mail", "Documento Word / PDF", "Formulário / Google Forms",
  "Caderno / Papel", "Telefone", "Software específico", "Outro"
] as const;

export const FINALIDADES_FERRAMENTA = [
  "Controle de dados", "Comunicação", "Relatórios", "Cadastro",
  "Orçamento / Financeiro", "Acompanhamento de tarefas", "Atendimento ao cliente",
  "Gestão de estoque", "Agenda / Calendário", "Outro"
] as const;

export const SATISFACAO_LEVELS = ["Péssimo", "Ruim", "Regular", "Bom", "Ótimo"] as const;

export interface UserProfile {
  id: string;
  nome: string;
  setor: Setor;
  funcao: string;
  unidade: string;
  resumoDiaDia: string;
  responsabilidades: string;
  qualidades: string;
  pontosMelhoria: string;
  tempoCasa: string;
  role: "admin" | "gestor" | "colaborador";
  onboardingCompleto: boolean;
  createdAt: string;
}

export interface DailyFormData {
  id: string;
  userId: string;
  setor: Setor;
  funcao: string;
  atividadesPrincipais: string;
  ferramentas: string[];
  tempoMedioPorAtividade: string;
  maiorConsumoTempo: string;
  impedimentos: string;
  audioUrl?: string;
  transcricaoAudio?: string;
  createdAt: string;
}

export interface RepetitiveProcess {
  id: string;
  userId: string;
  processo: string;
  frequencia: string;
  tempoMedio: string;
  dependeOutros: boolean;
  setorDependencia?: string;
  podeAutomatizar: boolean;
  comoAutomatizar?: string;
  audioUrl?: string;
  transcricaoAudio?: string;
  createdAt: string;
}

export interface Bottleneck {
  id: string;
  userId: string;
  descricao: string;
  impactos: string[];
  exemploReal: string;
  urgencia: string;
  jaResolveu: boolean;
  comoResolveu?: string;
  audioUrl?: string;
  transcricaoAudio?: string;
  perguntasIA?: string[];
  respostasIA?: string[];
  createdAt: string;
}

export interface Suggestion {
  id: string;
  userId: string;
  ideia: string;
  setorImpactado: Setor;
  beneficio: string;
  esforco: string;
  audioUrl?: string;
  transcricaoAudio?: string;
  createdAt: string;
}

export interface ToolMapping {
  id: string;
  userId: string;
  nomeFerramentaOuPlanilha: string;
  categoria: string;
  finalidade: string;
  descricaoUso: string;
  frequenciaUso: string;
  tempoGastoSemana: string;
  compartilhaCom: string;
  setoresEnvolvidos: string[];
  problemas: string;
  satisfacao: string;
  gostariaSubstituir: boolean;
  comoSeriaIdeal?: string;
  criadoPorVoce: boolean;
  quantasPessoasUsam: string;
  createdAt: string;
}
