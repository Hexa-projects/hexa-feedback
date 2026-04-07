

# HexaOS Sync 2.0 — Plano de Implementação

## Resumo

Consolidar a infraestrutura existente de fila (`openclaw_event_queue`) em uma arquitetura event-driven robusta: criar uma view de compatibilidade (`openclaw_sync_queue`), um worker agendado dedicado (`sync-openclaw-events`), eliminar polling de health-check, refatorar o painel de integração e emitir eventos automaticamente no CRM.

---

## 1. Migração SQL

Criar uma **view** `openclaw_sync_queue` com aliases exatos:

```sql
CREATE OR REPLACE VIEW public.openclaw_sync_queue AS
SELECT id, event_type, data AS payload, status,
       attempts AS retry_count, last_error,
       next_retry_at AS scheduled_for, created_at
FROM public.openclaw_event_queue;
```

A tabela base já possui todas as colunas necessárias (`attempts`, `next_retry_at`, `last_error`, `max_attempts`). Nenhuma alteração de schema na tabela original.

Adicionar policy de service_role para a edge function do worker:

```sql
CREATE POLICY "service_role_all_queue"
ON public.openclaw_event_queue FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

---

## 2. Edge Function: `sync-openclaw-events`

Novo worker dedicado que:
- Busca até 50 eventos `pending` ou `failed` onde `next_retry_at IS NULL OR next_retry_at <= now()`
- Lê config de `focus_ai_config` (url, token, ativo)
- Para cada evento, faz POST para `{OPENCLAW_BASE_URL}/api/chat` com timeout de 8s
- **Sucesso**: marca `status = 'delivered'`, grava `delivered_at`
- **Falha**: incrementa `attempts`, calcula backoff exponencial (`2^attempts * 1000 + random`), grava `next_retry_at` e `last_error` com a mensagem exata da exceção
- **Cap 5 retries**: move para `status = 'dlq'`
- Atualiza `openclaw_sync_status` com resultado

A lógica é extraída do `openclaw-sync` existente (action `process_queue`) para funcionar de forma autônoma, sem depender de chamada manual.

---

## 3. Agendamento pg_cron

Após deploy da edge function, agendar via SQL insert (não migração):

```sql
SELECT cron.schedule(
  'sync-openclaw-worker',
  '*/1 * * * *',
  $$ SELECT net.http_post(
    url:='https://fevmcjnaeuxydmxmkarw.supabase.co/functions/v1/sync-openclaw-events',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body:='{"source":"pg_cron"}'::jsonb
  ) AS request_id; $$
);
```

---

## 4. Refatorar `OpenClawSyncPanel.tsx`

Substituir o painel atual por:

**Indicadores de Saúde** (derivados dos eventos, sem polling `/health`):
- Status de conexão derivado dos últimos 10 eventos: todos `delivered` = "Ativo" (verde), algum `failed` = "Degradado" (amarelo), nenhum `delivered` recente = "Inativo" (cinza)
- Contagem de pendentes na fila
- Falhas nas últimas 24h

**Log de Auditoria** (tabela com Table components):
- Colunas: Data | Tipo de Evento | Status | Erro | Ações
- Botão [Reenviar] por evento (reseta status para `pending`, zera `attempts`)
- Botão [Ver Erro] com Dialog mostrando `last_error` completo

**Ações mantidas**: Processar Fila, Evento Teste, Reprocessar DLQ, Atualizar

---

## 5. Emissão de Eventos no CRM

Adicionar `createSalesEvent("lead_created", ...)` no `LeadForm.tsx` após inserção bem-sucedida do lead. Fire-and-forget (não bloqueia o usuário).

---

## 6. Atualizar `openclaw-events.ts`

Adicionar função `retryEvent(eventId)` para o botão de reenvio individual no painel.

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| Nova migração SQL | View + policy service_role |
| `supabase/functions/sync-openclaw-events/index.ts` | Criar worker |
| `src/components/OpenClawSyncPanel.tsx` | Refatorar UI completa |
| `src/lib/openclaw-events.ts` | Adicionar `retryEvent()` |
| `src/pages/crm/LeadForm.tsx` | Emitir `lead_created` |
| pg_cron (via insert tool) | Agendar a cada 1 minuto |

