import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import StatusBadge from '@/components/shared/StatusBadge';
import { ArrowLeft, Send, Paperclip, MoreVertical, User, Clock, CheckCheck, Check, Loader2, Phone, MessageSquare, Tag, Calendar, Hash } from 'lucide-react';
import FlowTrigger from '@/components/automation/FlowTrigger';
import { motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ConversationData {
  id: string;
  contact_name: string;
  contact_phone: string;
  status: string;
  tags: string[] | null;
  updated_at: string;
  created_at: string;
  assigned_agent_id: string | null;
}

interface ContactTag {
  id: string;
  tag: { id: string; name: string; color: string };
}

interface AgentProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface MessageData {
  id: string;
  content: string;
  sender_type: string;
  message_type: string;
  status: string;
  created_at: string;
}

export default function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactTags, setContactTags] = useState<ContactTag[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<AgentProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversation = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();
    if (data) {
      setConversation(data);
      // Fetch assigned agent
      if (data.assigned_agent_id) {
        const { data: agent } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', data.assigned_agent_id)
          .single();
        if (agent) setAssignedAgent(agent);
      } else {
        setAssignedAgent(null);
      }
      // Fetch contact tags
      const { data: tags } = await supabase
        .from('contact_tags')
        .select('id, tag_id, tags(id, name, color)')
        .eq('contact_phone', data.contact_phone);
      if (tags) {
        setContactTags(tags.map((t: any) => ({ id: t.id, tag: t.tags })));
      }
    }
  };

  const fetchMessages = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversation();
    fetchMessages();

    const channel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as MessageData]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `id=eq.${id}` }, () => {
        fetchConversation();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !id || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    try {
      await sendWhatsAppMessage(id, msg);
    } catch (err: any) {
      console.error('Send error:', err);
      toast.error('Erro ao enviar mensagem. Verifique a conexão do WhatsApp.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Conversa não encontrada
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/conversations')} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {conversation.contact_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">{conversation.contact_name}</p>
              <p className="text-[11px] text-muted-foreground">{conversation.contact_phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={conversation.status as 'new' | 'pending' | 'active' | 'resolved'} />
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin bg-background">
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.5) }}
              className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  msg.sender_type === 'agent'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-card border border-border text-card-foreground rounded-bl-md'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 ${msg.sender_type === 'agent' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  <span className="text-[10px]">{format(new Date(msg.created_at), 'HH:mm')}</span>
                  {msg.sender_type === 'agent' && (
                    msg.status === 'read' ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card p-4 relative">
          <div className="flex items-end gap-2">
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
              <Paperclip className="h-4 w-4" />
            </button>
            <FlowTrigger conversationId={id!} />
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                placeholder="Digite uma mensagem..."
                rows={1}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:flex w-72 flex-col border-l border-border bg-card">
        <div className="flex flex-col items-center py-8 px-4 border-b border-border">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground mb-3">
            {conversation.contact_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <p className="text-sm font-semibold text-card-foreground">{conversation.contact_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{conversation.contact_phone}</p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Informações</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-card-foreground">Não atribuído</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-card-foreground">Última msg: {format(new Date(conversation.updated_at), 'dd/MM HH:mm')}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {(conversation.tags || []).map(t => (
                <span key={t} className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
