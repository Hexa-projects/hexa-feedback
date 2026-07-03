## Objetivo

Trocar a autenticação do RD Station de **OAuth (api.rd.services)** para **Private Token / Token de Instância** do RD Station CRM legado (`https://crm.rdstation.com/api/v1`), que é a chave única gerada em *Configurações → Integrações → API do RD Station CRM*.

## O que muda

### 1. Backend — Edge Functions

**`_shared/rd-client.ts`**
- Nova base: `RD_CRM_V1_BASE = "https://crm.rdstation.com/api/v1"`.
- Substituir `getAccessToken` / refresh OAuth por `getPrivateToken(svc)` que lê:
  1. `crm_integrations.private_token_enc` (criptografado, prioridade)
  2. fallback `Deno.env.get("RD_STATION_PRIVATE_TOKEN")`
- Reescrever `rdFetch` para anexar `?token=...` na URL (mantendo retry/backoff).
- Reescrever `rdPaginate` — a v1 usa `?page=N&limit=200` e devolve `{ deals: [...], has_more, total }` (varia por recurso).
- Manter helpers `encryptSecret` / `decryptSecret` / `requireAdmin`.

**`_shared/rd-sync-runner.ts`** — trocar rotas e mapeadores para os endpoints v1:
- `/deals`, `/deal_stages`, `/deal_pipelines`, `/deal_sources`, `/deal_lost_reasons`, `/deal_products`, `/deal_custom_fields`
- `/contacts`, `/organizations`, `/users`, `/activities` (no lugar de tasks)
- Ajustar shape dos payloads (ex.: em v1 `_id` no lugar de `id`, `deal_stage_id`, etc.).

**`rd-save-credentials`** — passa a aceitar `{ private_token }` e grava criptografado em `crm_integrations.private_token_enc`. Continua retornando `has_private_token` para a UI.

**Funções OAuth** (`rd-oauth-start`, `rd-oauth-callback`) — desativar/remover, já que não são mais usadas.

### 2. Banco de dados

Migration:
- `ALTER TABLE crm_integrations ADD COLUMN private_token_enc text;`
- Grants preservados.

### 3. Frontend

Página `Settings → Integrations → RD Station`:
- Substituir o card "Credenciais OAuth (Client ID / Secret)" e o botão "Conectar via OAuth" por um único campo **Private Token** com botão *Salvar*.
- Manter os botões *Sincronização completa* e *Sincronização delta*.
- Manter as telas de Contatos e Empresas (consomem `rd_contacts` / `rd_organizations` — sem alteração).

### 4. Secrets

Um único secret opcional `RD_STATION_PRIVATE_TOKEN` como fallback. Prioridade continua sendo o valor salvo no banco pela UI.

## O que NÃO muda

- Tabelas `rd_*` de destino (schema já é genérico via `raw_payload`).
- Telas CRM (Contatos, Empresas, RequestsList).
- Lógica de aprovação/rejeição de solicitações.

## Passos de execução

1. Migration `private_token_enc` em `crm_integrations`.
2. Refatorar `_shared/rd-client.ts` (auth + fetch + paginação v1).
3. Refatorar `_shared/rd-sync-runner.ts` (rotas + mapeadores v1).
4. Atualizar `rd-save-credentials` para aceitar `private_token`.
5. Atualizar UI da página de integração RD Station.
6. Testar `rd-sync-full` com o token informado.

Ao final, você precisará colar o Private Token na nova tela de configurações.
