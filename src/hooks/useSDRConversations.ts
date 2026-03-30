import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sdrApi } from '@/services/sdr-api';
import {
  UIConversation,
  UIMessage,
  DBMessage,
  transformDBToUIMessage,
  MessageDirection,
  MessageType,
} from '@/types/sdr';
import { toast } from 'sonner';

export function useSDRConversations() {
  const [conversations, setConversations] = useState<UIConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const processedMessageIds = useRef(new Set<string>());

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sdrApi.fetchConversations();
      processedMessageIds.current.clear();
      data.forEach(conv => conv.messages.forEach(msg => processedMessageIds.current.add(msg.id)));
      setConversations(data);
    } catch (err) {
      console.error('[useSDRConversations] Error:', err);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();

    const messagesChannel = supabase
      .channel('sdr-messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const newMessage = payload.new as DBMessage;
        if (processedMessageIds.current.has(newMessage.id)) return;
        processedMessageIds.current.add(newMessage.id);

        setConversations(prev =>
          prev.map(conv => {
            if (conv.id !== newMessage.conversation_id) return conv;
            const uiMessage = transformDBToUIMessage(newMessage);
            if (conv.messages.some(m => m.id === uiMessage.id)) return conv;
            // Replace temp message if exists
            const tempIdx = conv.messages.findIndex(m =>
              m.id.startsWith('temp-') && m.content === uiMessage.content && m.fromType === uiMessage.fromType
            );
            if (tempIdx !== -1) {
              const updated = [...conv.messages];
              updated[tempIdx] = uiMessage;
              return { ...conv, messages: updated, lastMessage: newMessage.content || '', lastMessageTime: 'Agora' };
            }
            return {
              ...conv,
              messages: [...conv.messages, uiMessage],
              lastMessage: newMessage.content || '',
              lastMessageTime: 'Agora',
              unreadCount: newMessage.from_type === 'user' ? conv.unreadCount + 1 : conv.unreadCount,
            };
          })
        );
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const updated = payload.new as DBMessage;
        setConversations(prev =>
          prev.map(conv =>
            conv.id === updated.conversation_id
              ? { ...conv, messages: conv.messages.map(m => m.id === updated.id ? transformDBToUIMessage(updated) : m) }
              : conv
          )
        );
      })
      .subscribe();

    const convsChannel = supabase
      .channel('sdr-conversations-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
        const upd = payload.new as any;
        setConversations(prev =>
          prev.map(conv =>
            conv.id === upd.id ? { ...conv, status: upd.status, isActive: upd.is_active } : conv
          )
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(convsChannel);
    };
  }, [fetchConversations]);

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    if (!content.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const tempMessage: UIMessage = {
      id: tempId,
      content,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      direction: MessageDirection.OUTGOING,
      type: MessageType.TEXT,
      status: 'sent',
      fromType: 'human',
      mediaUrl: null,
      whatsappMessageId: null,
    };

    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? { ...conv, messages: [...conv.messages, tempMessage], lastMessage: content, lastMessageTime: 'Agora' }
          : conv
      )
    );

    try {
      await sdrApi.sendMessage(conversationId, content);
    } catch (err) {
      toast.error('Erro ao enviar mensagem');
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, messages: conv.messages.filter(m => m.id !== tempId) }
            : conv
        )
      );
    }
  }, []);

  const updateStatus = useCallback(async (conversationId: string, status: 'nina' | 'human' | 'paused') => {
    try {
      await sdrApi.updateConversationStatus(conversationId, status);
      setConversations(prev => prev.map(conv => conv.id === conversationId ? { ...conv, status } : conv));
      toast.success(status === 'nina' ? 'IA ativada' : status === 'human' ? 'Atendimento humano' : 'Conversa pausada');
    } catch {
      toast.error('Erro ao atualizar status');
    }
  }, []);

  const markAsRead = useCallback(async (conversationId: string) => {
    setConversations(prev => prev.map(conv => conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv));
    await sdrApi.markMessagesAsRead(conversationId);
  }, []);

  return { conversations, loading, sendMessage, updateStatus, markAsRead, refetch: fetchConversations };
}
