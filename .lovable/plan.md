
# HexaOS V3 - Plano de Implementação

## Fase 1: Infraestrutura
- Remover pacotes LiveKit (`livekit-client`, `@livekit/components-react`, `@livekit/components-styles`)
- Recriar tema visual Cyber-Corporate (dark mode nativo) no `index.css` e `tailwind.config.ts`
- Recriar `HexaLayout.tsx` com sidebar retrátil agrupada + topbar com AI Status

## Fase 2: Centro de Comando - The Swarm (`/swarm`)
- Grid de 5 agentes (Focus, Hunter, Gear, Tracker, Ledger) com status animado
- Timeline proativa global (lendo `focus_ai_logs`)
- Fila de aprovações executivas (lendo `ai_action_requests`)

## Fase 3: Módulos Operacionais (Refatorar páginas existentes)
- **Config MS Teams** (`/settings/teams`): Formulário de webhooks por agente
- **CRM Kanban** (`/crm/kanban`): Refatorar com cards mostrando tempo na etapa + ícone Hunter + modal de transição automática
- **OS Mobile-First** (`/os`): Lista com filtros + Execução de OS com checkin, checklist, consumo de peças, fotos
- **Inventário** (`/estoque`): Lista com alertas de estoque mínimo
- **Jornada da Peça** (`/estoque/rastreio`): Timeline vertical por Serial Number
- **Base de Conhecimento** (`/conhecimento`): Interface estilo Google Drive com upload de PDFs
- **Auditoria** (`/auditoria`): Onboarding + Daily Forms + Mapa de Gargalos
- **Financeiro** (`/financeiro`): Dashboard de rentabilidade com Recharts

## Fase 4: Limpeza
- Remover páginas/componentes obsoletos (MeetingRoom, AudioRecorder, CorporateChannels, etc.)
- Atualizar rotas no `App.tsx`

## Notas
- Todas as ações gravam no Supabase; nenhuma lógica de IA no front-end
- Hooks com TanStack React Query para todas as tabelas
- Componentes reutilizáveis com shadcn/ui
- ~15 arquivos novos/refatorados
