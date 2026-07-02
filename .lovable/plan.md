
# Push Notifications + Deep-link de Solicitações

## Parte 1 — Deep-link da notificação interna

**Banco (SQL manual via `db/manual-migrations/`)**
- Atualizar `notify_ceos_commercial_request_pending()`: gravar `link = '/crm/requests/' || NEW.id::text` (hoje grava `/crm/requests` sem id).

**Frontend**
- `NotificationDropdown.tsx`: manter `useNavigate` mas simplificar — se `n.link` existir, navegar direto; senão, se `metadata.request_id` existir, ir para `/crm/requests/:id`. Marca como lida.

## Parte 2 — Rota `/crm/requests/:id`

- Nova página `src/pages/crm/RequestDetailPage.tsx`:
  - `useParams<{ id }>()`, carrega a solicitação por id (com fallback direto do Supabase).
  - Estados: loading, erro, "não encontrada".
  - Reusa `RequestDetailModal` como conteúdo/painel, OU renderiza os mesmos blocos em página cheia.
  - Se `is_ceo_or_admin` (checar via `has_role` ou `funcao`) e status = `pendente`: botões Aprovar/Reprovar chamando as RPCs existentes `approve_commercial_request` e `reject_commercial_request`.
- Registrar rota em `HexaLayout`/router.

## Parte 3 — Push Notifications (Web Push + VAPID)

### Banco
Migration nova: cria `public.push_subscriptions` com colunas do prompt, RLS (owner CRUD + service_role full), GRANTs, unique `(user_id, endpoint)`, trigger `updated_at`.

### VAPID Keys
- Solicitar 3 secrets via `add_secret`:
  - `VAPID_PUBLIC_KEY` (também exposto no frontend via edge function ou secret `VITE_VAPID_PUBLIC_KEY` opcional — vamos buscar via edge function `get-vapid-public-key` para não hardcodar).
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (ex.: `mailto:admin@hexaos.com.br`)

### Service Worker
- Adicionar `public/push-sw.js` (worker dedicado, além do PWA cleanup sw existente) com listeners `push` e `notificationclick`. Escopo `/`. Registrado apenas quando o usuário ativa push (não conflita com PWA sw kill-switch).
- Payload: `{ title, body, url, tag, notification_id }`.
- `notificationclick`: focar aba existente e `postMessage` para navegar, ou abrir nova.

### Frontend
- `src/hooks/usePushNotifications.ts`:
  - Detecta suporte, permission, isSubscribed.
  - `subscribe()`: registra `/push-sw.js`, pede permissão, chama `pushManager.subscribe({ userVisibleOnly, applicationServerKey })`, faz upsert em `push_subscriptions`.
  - `unsubscribe()`: `subscription.unsubscribe()` + delete/disable no DB.
  - Detecta iOS + `!standalone` → expõe flag `iosNeedsInstall`.
  - Busca VAPID public key via edge function `get-vapid-public-key`.
- Nova seção em `SettingsPage.tsx`: card "Notificações no celular" com status, botões Ativar/Desativar, orientações Android/iOS.

### Edge Functions
1. `get-vapid-public-key` — retorna `VAPID_PUBLIC_KEY` (auth required).
2. `send-push-notification` — recebe `{ user_ids, title, body, url, tag, metadata }`, busca subs ativas, envia via `npm:web-push@3`. Marca `enabled=false` em 404/410.

### Trigger de integração
- No trigger PL/pgSQL `notify_ceos_commercial_request_pending`: após inserir notificações internas, usar `pg_net.http_post` para chamar `send-push-notification` com service role (chave em GUC `app.settings.service_role_key` — ou passar via secret na função). Se `pg_net` não estiver disponível, plano B: chamar `send-push-notification` diretamente do frontend após inserir a solicitação (mais simples, mas menos robusto).
- **Decisão:** usar `pg_net` — Supabase suporta por padrão. Fallback: cliente chama a edge function após criar solicitação (`RequestsList` já faz insert).

## Detalhes técnicos

- Todos os edge functions com `verify_jwt=false` (padrão) + `getClaims` em `send-push-notification` e `get-vapid-public-key`.
- `web-push` importado via `npm:web-push@3.6.7` no Deno.
- Payload sem PII: só empresa nome curto + link.
- Frontend nunca vê `VAPID_PRIVATE_KEY` nem service role.
- Manter PWA existente (`src/pwa/register.ts`) intacto — o novo push worker é arquivo separado.
- Notificação `link` passa a incluir id → `NotificationDropdown` fica mais simples.

## Arquivos a criar/editar

**Criar**
- `db/manual-migrations/2026-07-03_push_subscriptions.sql`
- `db/manual-migrations/2026-07-03_notify_link_with_id.sql`
- `public/push-sw.js`
- `src/hooks/usePushNotifications.ts`
- `src/pages/crm/RequestDetailPage.tsx`
- `supabase/functions/get-vapid-public-key/index.ts`
- `supabase/functions/send-push-notification/index.ts`

**Editar**
- `src/components/NotificationDropdown.tsx` — deep-link simplificado.
- `src/components/HexaLayout.tsx` (ou router) — rota `/crm/requests/:id`.
- `src/pages/SettingsPage.tsx` — seção push.
- `supabase/config.toml` — registrar as 2 edge functions.

## Fora de escopo
- Não altero UI de outras telas.
- Não altero fluxo de aprovação existente.
- Ícones do push usam `/icons/*` já existentes do PWA.
