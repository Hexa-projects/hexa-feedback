
## Objetivo
Ativar/revisar RLS em todas as tabelas `public.*` com o modelo:
- **admin**: acesso total.
- **gestor**: acesso total aos dados de negócio (igual admin em leitura/escrita), sem tocar em tabelas de configuração.
- **colaborador**: acesso apenas aos dados do próprio setor (`profiles.setor == setor da tabela`).

Nenhuma UI, rota ou workflow existente será modificado — só políticas de banco.

## Fundação (já existe no projeto)
- Enum `app_role` = `admin | gestor | colaborador`
- Enum `setor` (Comercial, Técnico, Laboratório, Administrativo, Financeiro, Logística, Diretoria)
- `public.has_role(_user_id, _role)` (security definer)
- `public.get_user_setor(_user_id)` (security definer)
- Tabelas `user_roles` e `profiles.setor`

## Novos helpers (security definer, `stable`)
```sql
-- Admin OU gestor
public.is_privileged(_uid uuid) returns boolean
-- Admin/gestor OU setor do usuário == setor pedido
public.can_access_setor(_uid uuid, _setor setor) returns boolean
-- Diretoria também é privilegiada em leitura
public.is_directoria(_uid uuid) returns boolean
```

## Mapeamento tabela → setor
```text
Comercial     → leads, deals, deal_activities, lead_interactions,
                commercial_requests, proposals, contracts, pipeline_stages
Técnico       → work_orders, work_order_activities, projects, project_tasks,
                installed_equipment
Laboratório   → lab_parts, knowledge_chunks
Logística     → stock_products, stock_movements, stock_journeys, inventory
Financeiro    → financial_records

Só admin        → focus_ai_config, focus_ai_skills, focus_ai_routines,
                  autonomy_rules, integration_configs, webhook_sources,
                  tag_definitions, data_catalog, ai_agents

Admin + gestor  → focus_ai_insights, focus_ai_logs, action_queue, agent_runs,
                  ai_audit_trail, ai_action_requests, automation_executions,
                  operational_events, kpi_snapshots, openclaw_*, webhook_events,
                  ai_learning_feedback, file_imports

Próprio + adm/gestor  → onboarding_*, daily_forms, repetitive_processes,
                       bottlenecks, suggestions, tool_mappings, ai_feedback,
                       notifications, ai_chat_messages

Todos autenticados    → profiles (self + admin/gestor veem todos),
                       user_roles (self read, admin write),
                       teams, team_members, corporate_channels,
                       channel_messages, channel_tasks, message_reactions,
                       meeting_logs, meeting_participants_map,
                       hex_calendar_events, hex_calendar_participants, hex_calendars,
                       whatsapp_contacts, whatsapp_conversations,
                       whatsapp_messages, whatsapp_logs
```

## Estratégia de política por categoria

**Setoriais** (ex: `leads`):
```sql
DROP POLICY IF EXISTS ...;
ENABLE RLS;
CREATE POLICY "leads_read"  FOR SELECT TO authenticated
  USING (public.can_access_setor(auth.uid(), 'Comercial'));
CREATE POLICY "leads_write" FOR ALL TO authenticated
  USING (public.can_access_setor(auth.uid(), 'Comercial'))
  WITH CHECK (public.can_access_setor(auth.uid(), 'Comercial'));
```

**Só admin**: `USING (public.has_role(auth.uid(),'admin'))`.

**Admin + gestor**: `USING (public.is_privileged(auth.uid()))`.

**Próprio + adm/gestor**:
```sql
USING (user_id = auth.uid() OR public.is_privileged(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_privileged(auth.uid()))
```

**Todos autenticados** (colab. + adm./gestor): `USING (auth.role() = 'authenticated')` — leitura ampla; escrita mais restrita conforme a tabela.

**profiles**: cada um lê/edita o seu; adm/gestor leem todos; só admin edita role.
**user_roles**: usuário lê o próprio; só admin escreve.

## GRANTs
Reaplicar em toda tabela `public.*`:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
```
Sem `GRANT` para `anon` — plataforma é 100% interna (memória do projeto).

## Entregáveis
1. Uma migração SQL única e idempotente (`DROP POLICY IF EXISTS` + `CREATE`), aplicada via ferramenta de migration.
2. Nenhuma mudança de UI/código React.
3. Após aplicar, verifico logs do preview em busca de erros 401/permission denied e ajusto pontualmente.

## Riscos
- Se algum código faz query como `anon` (sem sessão), passará a falhar. Mitigação: hoje todas as rotas usam `AuthContext` e o `supabase` client autenticado — checarei antes de aplicar.
- Edge Functions usam `service_role` e não são afetadas.
- Diretoria: incluída em `is_privileged` para não quebrar dashboards executivos.

Confirma para eu escrever e aplicar a migração?
