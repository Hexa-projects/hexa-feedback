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
