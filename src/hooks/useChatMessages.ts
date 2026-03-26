import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const MESSAGES_PER_PAGE = 50;

export interface ChatMessage {
  id: string;
  content: string;
  sender_type: string;
  message_type: string;
  status: string;
  created_at: string;
  media_url?: string | null;
  provider_error?: string | null;
  provider_status?: string | null;
  sender_agent_id?: string | null;
  sender_label?: string | null;
}

export function useChatMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const channelRef = useRef<any>(null);

  const loadInitial = useCallback(async () => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('messages')
      .select('id, content, sender_type, message_type, status, created_at, media_url, provider_error, provider_status, sender_agent_id, sender_label')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE + 1);

    if (data) {
      setHasMore(data.length > MESSAGES_PER_PAGE);
      setMessages(data.slice(0, MESSAGES_PER_PAGE).reverse());
    }
    setLoading(false);
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!conversationId || !messages.length || loadingMore) return;
    setLoadingMore(true);

    const oldestTimestamp = messages[0].created_at;
    const { data } = await supabase
      .from('messages')
      .select('id, content, sender_type, message_type, status, created_at, media_url, provider_error, provider_status, sender_agent_id, sender_label')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldestTimestamp)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE + 1);

    if (data) {
      setHasMore(data.length > MESSAGES_PER_PAGE);
      setMessages((prev) => [...data.slice(0, MESSAGES_PER_PAGE).reverse(), ...prev]);
    }
    setLoadingMore(false);
  }, [conversationId, messages, loadingMore]);

  const markAsRead = useCallback(async () => {
    if (!conversationId) return;
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'customer')
      .neq('status', 'read');
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setLoading(true);

    if (!conversationId) {
      setLoading(false);
      return;
    }

    loadInitial();

    // Realtime subscription
    const channel = supabase
      .channel(`chat-msg-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender_type === 'customer') {
          markAsRead();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { messages, setMessages, loading, hasMore, loadMore, loadingMore, markAsRead };
}
