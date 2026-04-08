

## Plan: Reinvention of "IA & Automação" and "Feedback & Processos" Sections

### Overview
Clean up two polluted sidebar sections, replacing them with two focused hubs: **NÚCLEO AI** (2 items) and **AUDITORIA OPERACIONAL** (2 items). Remove 8 obsolete routes and create 3 new pages.

---

### Step 1: Route & Sidebar Cleanup

**Remove from sidebar and routes (App.tsx):**
- `/agentes` (AgentsDashboard)
- `/ops` (OpsDashboard)
- `/openclaw/kpis` (OpenClawKpiDashboard)
- `/openclaw/audit` (OpenClawAgentAudit)
- `/openclaw/console` (OpenClawOpsConsole)
- `/api-docs` (ApiDocsPage)
- `/playbook` (SDRPlaybook)
- `/tools` (ToolsMapping)
- `/processes` (RepetitiveProcesses)
- `/suggestions` (Suggestions)

**Keep:** `/focus-ai`, `/daily`, `/bottlenecks`, `/history`, `/settings`

Remove the lazy imports for deleted routes. Remove `Playbook SDR` from Comercial group.

---

### Step 2: Update Sidebar Navigation (HexaLayout.tsx)

Replace the `feedback` and `ia` groups with:

```text
NÚCLEO AI (Brain icon, admin only)
├── The Swarm          → /focus-ai
└── Regras & MS Teams  → /automations

AUDITORIA OPERACIONAL (ClipboardList icon)
├── Mapa de Gargalos   → /gargalos
└── Coleta de Dados    → /coleta
```

Update `ROLE_GROUPS` and `SETOR_GROUPS` to replace `feedback`/`ia` with `nucleo_ai`/`auditoria`.

---

### Step 3: Create `/automations` Page (AutomationsPage.tsx)

New page with two tabs (shadcn Tabs):

**Tab 1 — "Webhooks do Teams":**
- 4 input fields for webhook URLs: Diretoria, Comercial, Operações, Laboratório
- Reads/writes `integration_configs` (integration_name = `ms_teams_webhooks`)
- "Testar Conexão" button per field
- "Salvar" button

**Tab 2 — "Matriz de Autonomia":**
- Reads `autonomy_rules` table
- Renders each rule as a card with: name, description, domain badge, and a `Switch` toggle
- Toggle updates `ativo` field on `autonomy_rules`
- Grouped visually by domain (comercial, operacoes, laboratorio, geral)

---

### Step 4: Create `/gargalos` Page (GargalosMap.tsx)

- Reads `focus_ai_insights` table
- Groups insights by `domain` (Comercial, Operações, Laboratório, Geral)
- Each domain is a column (masonry/grid layout, 2-3 cols on desktop)
- Each insight card shows:
  - `titulo` (bold)
  - `causa_provavel`
  - `acao_recomendada`
  - Priority badge from `prioridade`
  - "Resolver" button → updates `status` to `resolvido`

---

### Step 5: Create `/coleta` Page (DataCollection.tsx)

Page with two shadcn Tabs:

**Tab 1 — "Raio-X (Onboarding)":**
- Embeds the existing onboarding wizard steps (StepIdentidade, StepRotina, StepProcessos, StepGargalos, StepContato)
- Writes to `onboarding_responses` table
- Reuses existing onboarding components

**Tab 2 — "Meu Dia (Daily)":**
- Simplified mobile-first form: "O que fiz hoje" (Textarea), "Impedimentos" (Textarea), optional audio recorder
- Large touch-friendly buttons
- Writes to `daily_forms` table
- Reuses logic from existing DailyForm but in a slimmed-down UI

---

### Step 6: Update App.tsx Routes

Add new routes:
- `/automations` → AutomationsPage
- `/gargalos` → GargalosMap
- `/coleta` → DataCollection

Redirect old routes to new ones:
- `/daily` → `/coleta`
- `/bottlenecks` → `/gargalos`

---

### Files to Create
- `src/pages/AutomationsPage.tsx`
- `src/pages/GargalosMap.tsx`
- `src/pages/DataCollection.tsx`

### Files to Edit
- `src/components/HexaLayout.tsx` (sidebar restructure)
- `src/App.tsx` (route cleanup + new routes + redirects)

### No Database Changes Required
All tables already exist: `integration_configs`, `autonomy_rules`, `focus_ai_insights`, `onboarding_responses`, `daily_forms`.

