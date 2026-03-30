import { supabase } from "@/integrations/supabase/client";
import {
  DBConversation,
  DBMessage,
  UIConversation,
  transformDBToUIConversation,
  Deal,
  DealActivity,
  KanbanColumn,
  TagDefinition,
} from "@/types/sdr";

const getCurrentUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  return user.id;
};

export const sdrApi = {
  // ===================== CONVERSATIONS =====================
  fetchConversations: async (): Promise<UIConversation[]> => {
    const { data: convs, error } = await supabase
      .from('whatsapp_conversations')
      .select(`*, contact:whatsapp_contacts(*)`)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[SDR API] Error fetching conversations:', error);
      return [];
    }

    const results: UIConversation[] = [];
    for (const conv of (convs || [])) {
      const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('sent_at', { ascending: true })
        .limit(100);

      results.push(
        transformDBToUIConversation(
          conv as unknown as DBConversation,
          (messages || []) as DBMessage[]
        )
      );
    }
    return results;
  },

  sendMessage: async (conversationId: string, content: string) => {
    const userId = await getCurrentUserId();

    // Get conversation to find contact phone
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('contact_id, whatsapp_contacts(phone_number)')
      .eq('id', conversationId)
      .single();

    // Insert message in DB
    const { error } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        content,
        type: 'text',
        from_type: 'human',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Update conversation last_message_at
    await supabase
      .from('whatsapp_conversations')
      .update({ last_message_at: new Date().toISOString(), status: 'human' })
      .eq('id', conversationId);

    // Send via Evolution API (Edge Function)
    const phone = (conv as any)?.whatsapp_contacts?.phone_number;
    if (phone) {
      try {
        await supabase.functions.invoke('whatsapp-service', {
          body: { action: 'send', to: phone, message: content }
        });
      } catch (err) {
        console.warn('[SDR API] WhatsApp send failed (message saved):', err);
      }
    }
  },

  updateConversationStatus: async (conversationId: string, status: string) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ status })
      .eq('id', conversationId);
    if (error) throw error;
  },

  markMessagesAsRead: async (conversationId: string) => {
    await supabase
      .from('whatsapp_messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('from_type', 'user')
      .neq('status', 'read');
  },

  // ===================== CONTACTS =====================
  fetchContacts: async () => {
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .order('last_activity', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[SDR API] Error fetching contacts:', error);
      return [];
    }
    return data || [];
  },

  updateContactTags: async (contactId: string, tags: string[]) => {
    const { error } = await supabase
      .from('whatsapp_contacts')
      .update({ tags })
      .eq('id', contactId);
    if (error) throw error;
  },

  updateContactNotes: async (contactId: string, notes: string) => {
    const { error } = await supabase
      .from('whatsapp_contacts')
      .update({ notes })
      .eq('id', contactId);
    if (error) throw error;
  },

  // ===================== PIPELINE =====================
  fetchPipelineStages: async (): Promise<KanbanColumn[]> => {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (error) {
      console.error('[SDR API] Error fetching stages:', error);
      return [];
    }

    return (data || []).map(s => ({
      id: s.id,
      title: s.title,
      color: s.color || '',
      position: s.position,
      isSystem: s.is_system || false,
      isActive: s.is_active || true,
      isAiManaged: s.is_ai_managed || false,
      aiTriggerCriteria: s.ai_trigger_criteria || null,
    }));
  },

  fetchDeals: async (): Promise<Deal[]> => {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SDR API] Error fetching deals:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      title: d.title,
      company: d.company || '',
      value: Number(d.value) || 0,
      stageId: d.stage_id || undefined,
      ownerId: d.owner_id || undefined,
      ownerName: d.owner_name || undefined,
      tags: d.tags || [],
      dueDate: d.due_date || undefined,
      priority: (d.priority as Deal['priority']) || 'medium',
      contactId: d.contact_id || undefined,
      contactName: d.contact_name || undefined,
      contactPhone: d.contact_phone || undefined,
      qualificationScore: d.qualification_score || 0,
      conversationId: d.conversation_id || undefined,
      wonAt: d.won_at || undefined,
      lostAt: d.lost_at || undefined,
      lostReason: d.lost_reason || undefined,
    }));
  },

  createDeal: async (deal: Partial<Deal>) => {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('deals')
      .insert({
        title: deal.title || 'Novo Deal',
        company: deal.company || '',
        value: deal.value || 0,
        stage_id: deal.stageId,
        priority: deal.priority || 'medium',
        contact_id: deal.contactId,
        contact_name: deal.contactName,
        contact_phone: deal.contactPhone,
        tags: deal.tags || [],
        user_id: userId,
      });
    if (error) throw error;
  },

  moveDealStage: async (dealId: string, stageId: string) => {
    const { error } = await supabase
      .from('deals')
      .update({ stage_id: stageId })
      .eq('id', dealId);
    if (error) throw error;
  },

  markDealWon: async (dealId: string) => {
    const stages = await sdrApi.fetchPipelineStages();
    const wonStage = stages.find(s => s.title.toLowerCase() === 'ganho');
    const { error } = await supabase
      .from('deals')
      .update({ won_at: new Date().toISOString(), stage_id: wonStage?.id })
      .eq('id', dealId);
    if (error) throw error;
  },

  markDealLost: async (dealId: string, reason: string) => {
    const stages = await sdrApi.fetchPipelineStages();
    const lostStage = stages.find(s => s.title.toLowerCase() === 'perdido');
    const { error } = await supabase
      .from('deals')
      .update({ lost_at: new Date().toISOString(), lost_reason: reason, stage_id: lostStage?.id })
      .eq('id', dealId);
    if (error) throw error;
  },

  // ===================== DEAL ACTIVITIES =====================
  fetchDealActivities: async (dealId: string): Promise<DealActivity[]> => {
    const { data, error } = await supabase
      .from('deal_activities')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []).map(a => ({
      id: a.id,
      dealId: a.deal_id,
      type: a.type as DealActivity['type'],
      title: a.title,
      description: a.description || undefined,
      scheduledAt: a.scheduled_at || undefined,
      completedAt: a.completed_at || undefined,
      isCompleted: a.is_completed || false,
      createdBy: a.created_by || undefined,
      createdByName: a.created_by_name || undefined,
      createdAt: a.created_at,
    }));
  },

  createDealActivity: async (activity: { dealId: string; type: string; title: string; description?: string }) => {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('deal_activities')
      .insert({
        deal_id: activity.dealId,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        created_by: userId,
      });
    if (error) throw error;
  },

  deleteDealActivity: async (activityId: string) => {
    const { error } = await supabase
      .from('deal_activities')
      .delete()
      .eq('id', activityId);
    if (error) throw error;
  },

  // ===================== TAGS =====================
  fetchTagDefinitions: async (): Promise<TagDefinition[]> => {
    const { data, error } = await supabase
      .from('tag_definitions')
      .select('*')
      .eq('is_active', true)
      .order('category');

    if (error) return [];
    return (data || []).map(t => ({
      id: t.id,
      key: t.key,
      label: t.label,
      color: t.color || '#3b82f6',
      category: t.category || 'geral',
      is_active: t.is_active ?? true,
    }));
  },

  createTagDefinition: async (tag: { key: string; label: string; color: string; category: string }) => {
    const { data, error } = await supabase
      .from('tag_definitions')
      .insert(tag)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
