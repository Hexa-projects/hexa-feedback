# Fase 1 — Integração RD Station CRM v2

Escopo confirmado: **schema + OAuth + sync full/delta + webhook + tela de integração**. UI de merge (leads/companies/deals/kanban unificados) e MCP interno ficam para Fase 2/3. O CRM atual do HexaOS (LeadsList, KanbanFunnel, RequestsList) **não é alterado** nesta fase.

## Segurança e segredos

Já salvos: `RD_STATION_CLIENT_ID`, `RD_STATION_CLIENT_SECRET`. Tokens RD (`access_token`, `refresh_token`) vivem apenas no Supabase, criptografados em repouso via `pgsodium` (ou coluna `text` protegida por RLS estrita — decido no momento se `pgsodium` estiver disponível no projeto). Frontend nunca recebe tokens; toda troca passa por Edge Function com JWT do usuário.

## 1. Migração de banco

Migration única `crm_rd_station_integration` criando:

**Infra de integração**
- `crm_integrations` — provider (`rd_station`), status, `client_id`, escopo, timestamps. RLS: só admin/CEO.
- `crm_external_accounts` — 1 conta RD por workspace: `access_token_enc`, `refresh_token_enc`, `expires_at`, `rd_account_id`, `connected_by`, `connected_at`. RLS: só admin/CEO; service_role total.
- `rd_sync_jobs` — `id`, `type` (`full`|`delta`|`webhook`), `status` (`queued`|`running`|`success`|`error`|`partial`), `started_at`, `finished_at`, `stats jsonb`, `error`, `triggered_by`.
- `rd_sync_logs` — `job_id`, `entity`, `level` (`info`|`warn`|`error`), `message`, `context jsonb`, `created_at`. Nunca guarda token/secret; sanitização no server.
- `rd_webhook_events` — `id`, `event_type`, `event_hash` (unique — dedup), `payload jsonb`, `received_at`, `processed_at`, `status`, `error`.

**Entidades espelhadas (todas com padrão comum)**
Campos comuns em cada tabela: `id uuid pk default gen_random_uuid()`, `rd_id text unique not null`, `raw_payload jsonb not null`, `rd_created_at timestamptz`, `rd_updated_at timestamptz`, `last_synced_at timestamptz default now()`, `sync_status text default 'synced'`, `deleted_at timestamptz`, `created_at`, `updated_at`.

Tabelas: `rd_users`, `rd_custom_fields`, `rd_pipelines`, `rd_pipeline_stages` (FK `pipeline_id → rd_pipelines`), `rd_sources`, `rd_lost_reasons`, `rd_products`, `rd_organizations`, `rd_contacts` (FK opcional `organization_id`), `rd_deals` (FKs `pipeline_id`, `stage_id`, `user_id`, `organization_id`, `contact_id`, `source_id`, `lost_reason_id`), `rd_tasks` (FK opcional `deal_id`, `user_id`).

Colunas denormalizadas úteis (nome, email, valor, etc.) além do `raw_payload` para queries rápidas na UI.

**GRANTs obrigatórios** em todas as tabelas `public.*`: `SELECT/INSERT/UPDATE/DELETE` para `authenticated`, `ALL` para `service_role`, sem grants para `anon`.

**RLS**
- `crm_integrations`, `crm_external_accounts`, `rd_sync_jobs`, `rd_sync_logs`, `rd_webhook_events`: leitura só para roles `admin`/`ceo` (via `has_role`).
- `rd_*` (dados de negócio): leitura para `authenticated`; mutação apenas via `service_role` (Edge Functions).

**Índices**: `rd_id`, `rd_updated_at`, `deleted_at`, FKs, `event_hash` unique.

## 2. Edge Functions (sete)

Todas com CORS padrão, validação Zod, JWT verificado via `getClaims()` exceto webhook. Nenhum token vazado em logs.

### `rd-oauth-start`
- Auth: usuário admin/CEO logado.
- Gera state (hmac), grava em `crm_integrations.pending_state`, retorna URL de autorização:
  `https://api.rd.services/auth/dialog?client_id=...&redirect_uri=SUPABASE_URL/functions/v1/rd-oauth-callback&state=...`.

### `rd-oauth-callback`
- Público (sem JWT). Valida `state`, troca `code` por tokens em `https://api.rd.services/auth/token`, criptografa e persiste em `crm_external_accounts`, marca `crm_integrations.status='connected'`, redireciona para `/crm/integrations/rd-station?connected=1`.

### `rd-refresh-token`
- Interno. Chamada pelas outras functions antes de qualquer request: se `expires_at - now() < 5min`, faz `POST /auth/token` com `refresh_token`, atualiza **os dois** tokens (RD rotaciona refresh_token) e o `expires_at`.

### `rd-sync-full`
- Auth: admin/CEO. Cria `rd_sync_jobs` (`type=full`), roda em background via `EdgeRuntime.waitUntil`, importa nesta ordem: `users → custom_fields → pipelines → stages → sources → lost_reasons → products → organizations → contacts → deals → tasks`. Paginação (`page`, `limit=200`), upsert por `rd_id`. Após cada entidade, grava `rd_sync_logs`. Atualiza `stats` no job. Trata 429 com backoff exponencial.

### `rd-sync-delta`
- Auth: admin/CEO. Igual ao full mas com filtro `updated_at_period[start]=<last_synced_at>` quando a entidade suportar; entidades sem esse filtro caem para full incremental por `rd_id`. Atualiza `last_synced_at` global no `crm_integrations`.

### `rd-webhook`
- Público (RD Station não assina). Retorna `200 OK` em <1s: computa `event_hash = sha256(event_type + payload_id + updated_at)`, faz `INSERT ... ON CONFLICT (event_hash) DO NOTHING` em `rd_webhook_events`, dispara processamento assíncrono via `EdgeRuntime.waitUntil` (upsert na tabela normalizada correspondente + log). Se conflict → já processado, responde 200.

### `rd-create-webhooks`
- Auth: admin/CEO. Chama `POST /crm/v2/webhooks` no RD para os eventos mínimos listados, apontando para `SUPABASE_URL/functions/v1/rd-webhook`. Idempotente: lista os webhooks existentes primeiro e cria só os que faltam.

`supabase/config.toml`: `rd-oauth-callback` e `rd-webhook` com `verify_jwt = false`; demais com verify_jwt padrão + validação `getClaims()` no código.

## 3. Cliente Supabase compartilhado (Edge)

`supabase/functions/_shared/rd-client.ts`:
- `getAccessToken(supabase)` — lê `crm_external_accounts`, renova se necessário chamando `rd-refresh-token` internamente.
- `rdFetch(path, opts)` — wrapper com retry 429/5xx (backoff), headers `Authorization: Bearer`, timeout 25s.
- `paginate(path, params)` — async iterator que percorre todas as páginas.
- `encrypt/decrypt` — helpers usando `SUPABASE_SERVICE_ROLE` + `pgsodium` (se disponível) ou fallback AES-GCM com chave derivada de segredo dedicado (`RD_TOKEN_ENC_KEY`, gerado com `generate_secret` se `pgsodium` não estiver instalado).

## 4. Frontend — apenas a tela de integração

Nova rota: `/crm/integrations/rd-station` → `src/pages/crm/integrations/RdStationIntegration.tsx`.

Componentes:
- Header com status (badge `Conectado`/`Desconectado`), última sincronização, ID da conta RD.
- Botão **Conectar RD Station** → chama `rd-oauth-start` via `supabase.functions.invoke`, redireciona para URL retornada.
- Botão **Sincronização completa** → dispara `rd-sync-full`, mostra progresso via polling em `rd_sync_jobs` (Realtime na Fase 2).
- Botão **Sincronizar alterações** → `rd-sync-delta`.
- Botão **Registrar webhooks** → `rd-create-webhooks`.
- Cards com contagens: `SELECT count(*) FROM rd_pipelines/rd_deals/…` (view agregada `rd_sync_counts`).
- Tabela de últimos jobs (`rd_sync_jobs` order by `started_at desc limit 10`) com status e stats.
- Painel "Erros recentes" — últimos 20 registros de `rd_sync_logs` com `level='error'`.
- Painel de webhooks ativos (lista consultada via nova função `rd-list-webhooks` — small, incluída junto de `rd-create-webhooks`).

Link no menu lateral (`HexaLayout`) só para admin/CEO: **Integrações → RD Station** (sob o grupo "Configurações" ou "CRM"). Nenhuma outra tela do CRM é tocada.

## 5. Validação

- `npm run build` limpo, tipagem OK.
- Fluxo manual: conectar → sync full → verificar contagens → registrar webhooks → simular evento (curl) → confirmar dedup.
- `rd_sync_logs` sem nenhum token exposto (checar amostra).
- RLS testada: usuário comum não vê `crm_external_accounts`.

## Fora de escopo (Fases 2/3)

- Rotas `/crm/leads`, `/crm/companies`, `/crm/contacts`, `/crm/deals`, `/crm/kanban`, `/crm/tasks`, `/crm/sync-logs` unificados.
- Merge/dedup entre leads HexaOS ↔ contacts RD (por email/CNPJ/telefone).
- Camada MCP interna (`rd.list_*`, `rd.search_crm`, etc.).
- Realtime na UI (polling agora, Realtime depois).
- Reprocessamento manual de webhooks falhos.

Confirmando este plano, eu executo: migration → 3 secrets adicionais se necessário (`RD_TOKEN_ENC_KEY` via `generate_secret`) → 8 Edge Functions + shared client → tela React → deploy → build check.