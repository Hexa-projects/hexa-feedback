// ============= SDR Types (Ported from Nina) =============

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio'
}

export enum MessageDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing'
}

export type ConversationStatus = 'nina' | 'human' | 'paused';
export type MessageFromType = 'user' | 'nina' | 'human';
export type DBMessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'processing';
export type DBMessageType = 'text' | 'audio' | 'image' | 'document' | 'video';

export interface ClientMemory {
  last_updated: string | null;
  lead_profile: {
    interests: string[];
    lead_stage: string;
    objections: string[];
    products_discussed: string[];
    communication_style: string;
    qualification_score: number;
  };
  sales_intelligence: {
    pain_points: string[];
    next_best_action: string;
    budget_indication: string;
    decision_timeline: string;
  };
  interaction_summary: {
    response_pattern: string;
    last_contact_reason: string;
    total_conversations: number;
    preferred_contact_time: string;
  };
  conversation_history: Array<{
    timestamp: string;
    user_summary: string;
    ai_action: string;
  }>;
}

export interface DBContact {
  id: string;
  phone_number: string;
  whatsapp_id: string | null;
  name: string | null;
  call_name: string | null;
  email: string | null;
  profile_picture_url: string | null;
  tags: string[];
  notes: string | null;
  is_business: boolean;
  is_blocked: boolean;
  client_memory: ClientMemory;
  resumo_vivo: string | null;
  empresa: string | null;
  cargo: string | null;
  cidade: string | null;
  estado: string | null;
  linha_negocio: string | null;
  first_contact_date: string;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

export interface DBConversation {
  id: string;
  contact_id: string;
  status: ConversationStatus;
  is_active: boolean;
  assigned_user_id: string | null;
  assigned_team: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  nina_context: Record<string, unknown>;
  instance_id: string | null;
  started_at: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  contact?: DBContact;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  whatsapp_message_id: string | null;
  content: string | null;
  type: DBMessageType;
  from_type: MessageFromType;
  status: DBMessageStatus;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  processed_by_nina: boolean;
  nina_response_time: number | null;
  metadata: Record<string, unknown>;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface UIConversation {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar: string;
  contactEmail: string | null;
  status: ConversationStatus;
  isActive: boolean;
  assignedTeam: string | null;
  assignedUserId: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  tags: string[];
  messages: UIMessage[];
  clientMemory: ClientMemory;
  notes: string | null;
  resumoVivo: string | null;
  empresa: string | null;
  linhaNegocio: string | null;
}

export interface UIMessage {
  id: string;
  content: string;
  timestamp: string;
  direction: MessageDirection;
  type: MessageType;
  status: 'sent' | 'delivered' | 'read';
  fromType: MessageFromType;
  mediaUrl: string | null;
  whatsappMessageId: string | null;
}

export interface Deal {
  id: string;
  title: string;
  company: string;
  value: number;
  stageId?: string;
  ownerId?: string;
  ownerName?: string;
  tags: string[];
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  qualificationScore?: number;
  conversationId?: string;
  wonAt?: string;
  lostAt?: string;
  lostReason?: string;
}

export interface DealActivity {
  id: string;
  dealId: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'task';
  title: string;
  description?: string;
  scheduledAt?: string;
  completedAt?: string;
  isCompleted: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  position: number;
  isSystem: boolean;
  isActive: boolean;
  isAiManaged: boolean;
  aiTriggerCriteria: string | null;
}

export interface TagDefinition {
  id: string;
  key: string;
  label: string;
  color: string;
  category: string;
  is_active: boolean;
}

// ============= Transform Functions =============

export function getDefaultClientMemory(): ClientMemory {
  return {
    last_updated: null,
    lead_profile: {
      interests: [],
      lead_stage: 'new',
      objections: [],
      products_discussed: [],
      communication_style: 'unknown',
      qualification_score: 0
    },
    sales_intelligence: {
      pain_points: [],
      next_best_action: 'qualify',
      budget_indication: 'unknown',
      decision_timeline: 'unknown'
    },
    interaction_summary: {
      response_pattern: 'unknown',
      last_contact_reason: '',
      total_conversations: 0,
      preferred_contact_time: 'unknown'
    },
    conversation_history: []
  };
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function mapDBMessageType(type: DBMessageType): MessageType {
  switch (type) {
    case 'image': return MessageType.IMAGE;
    case 'audio': return MessageType.AUDIO;
    default: return MessageType.TEXT;
  }
}

function mapDBMessageStatus(status: DBMessageStatus): 'sent' | 'delivered' | 'read' {
  switch (status) {
    case 'read': return 'read';
    case 'delivered': return 'delivered';
    default: return 'sent';
  }
}

export function transformDBToUIMessage(msg: DBMessage): UIMessage {
  return {
    id: msg.id,
    content: msg.content || '',
    timestamp: formatMessageTime(msg.sent_at),
    direction: msg.from_type === 'user' ? MessageDirection.INCOMING : MessageDirection.OUTGOING,
    type: mapDBMessageType(msg.type),
    status: mapDBMessageStatus(msg.status),
    fromType: msg.from_type,
    mediaUrl: msg.media_url,
    whatsappMessageId: msg.whatsapp_message_id
  };
}

export function transformDBToUIConversation(
  conv: DBConversation,
  messages: DBMessage[]
): UIConversation {
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
  );

  const lastMsg = sortedMessages[sortedMessages.length - 1];
  const unreadCount = messages.filter(
    m => m.from_type === 'user' && m.status !== 'read'
  ).length;

  return {
    id: conv.id,
    contactId: conv.contact_id,
    contactName: conv.contact?.name || conv.contact?.call_name || conv.contact?.phone_number || 'Desconhecido',
    contactPhone: conv.contact?.phone_number || '',
    contactAvatar: conv.contact?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.contact?.name || 'U')}&background=0ea5e9&color=fff`,
    contactEmail: conv.contact?.email || null,
    status: conv.status,
    isActive: conv.is_active,
    assignedTeam: conv.assigned_team,
    assignedUserId: conv.assigned_user_id,
    lastMessage: lastMsg?.content || '',
    lastMessageTime: formatRelativeTime(conv.last_message_at),
    unreadCount,
    tags: [...(conv.tags || []), ...(conv.contact?.tags || [])],
    messages: sortedMessages.map(transformDBToUIMessage),
    clientMemory: conv.contact?.client_memory || getDefaultClientMemory(),
    notes: conv.contact?.notes || null,
    resumoVivo: conv.contact?.resumo_vivo || null,
    empresa: conv.contact?.empresa || null,
    linhaNegocio: conv.contact?.linha_negocio || null,
  };
}
