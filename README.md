# HexaOS — Sistema Operacional Corporativo

Plataforma interna para gestão de equipes, ordens de serviço, CRM, estoque, reuniões e IA.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Auth, DB, Storage, Edge Functions)
- **Reuniões:** LiveKit Cloud (vídeo/áudio em tempo real)
- **IA:** OpenAI (resumos), ElevenLabs Scribe v2 (transcrição)
- **WhatsApp:** Evolution API (notificações e resumos)

## Setup Local

```bash
# 1. Clone o repositório
git clone <repo-url> && cd hexa-feedback

# 2. Instale dependências
npm install

# 3. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Supabase

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

## Secrets (Supabase Edge Functions)

Configure no dashboard do Supabase (Settings → Edge Functions → Secrets):

| Secret | Descrição |
|---|---|
| `LIVEKIT_API_KEY` | API Key do LiveKit Cloud |
| `LIVEKIT_API_SECRET` | API Secret do LiveKit Cloud |
| `LIVEKIT_URL` | URL do LiveKit Cloud (wss://...) |
| `OPENAI_API_KEY` | Chave da OpenAI para resumos |
| `ELEVENLABS_API_KEY` | Chave ElevenLabs para transcrição |

## Fluxo de Reuniões

1. Usuário clica "Reunião" → `livekit-token` gera JWT e registra em `meeting_logs`
   - Alternativa programática: `POST /functions/v1/create-meeting` (usado pelo Focus AI)
2. LiveKit envia `participant_joined`/`participant_left` → webhook atualiza participantes
3. Áudio gravado → `livekit-transcribe` transcreve via ElevenLabs
4. Sala encerrada (`room_finished`) → webhook gera resumo por participante e envia via WhatsApp DM

## Deploy

O deploy é automático via Lovable. Edge Functions são publicadas automaticamente.

### Webhook LiveKit

Configure no LiveKit Cloud Dashboard:
- **URL:** `https://<project-id>.supabase.co/functions/v1/livekit-webhook`
- **Events:** `participant_joined`, `participant_left`, `room_finished`
