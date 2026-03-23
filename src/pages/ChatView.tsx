import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import StatusBadge from '@/components/shared/StatusBadge';
import { ArrowLeft, Send, Paperclip, MoreVertical, User, Clock, CheckCheck, Check, Loader2, Phone, MessageSquare, Tag, Calendar, Hash, History } from 'lucide-react';
import FlowTrigger from '@/components/automation/FlowTrigger';
import QuickMessages from '@/components/chat/QuickMessages';
import TagManager from '@/components/tags/TagManager';
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
  ctwa_clid: string | null;
  source_id: string | null;
  ad_title: string | null;
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

interface AssignmentHistory {
  id: string;
  agent_name: string;
  assigned_at: string;
  unassigned_at: string | null;
}

interface MessageData {
  id: string;
  content: string;
  sender_type: string;
  message_type: string;
  status: string;
  created_at: string;
  media_url?: string | null;
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
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
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
      // Fetch assignment history
      const { data: history } = await supabase
        .from('agent_assignment_history')
        .select('id, assigned_at, unassigned_at, agent_id, profiles(full_name)')
        .eq('conversation_id', id)
        .order('assigned_at', { ascending: false });
      if (history) {
        setAssignmentHistory(history.map((h: any) => ({
          id: h.id,
          agent_name: h.profiles?.full_name || 'Agente removido',
          assigned_at: h.assigned_at,
          unassigned_at: h.unassigned_at,
        })));
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

  const markMessagesAsRead = async () => {
    if (!id) return;
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('conversation_id', id)
      .eq('sender_type', 'customer')
      .neq('status', 'read');
  };

  useEffect(() => {
    fetchConversation();
    fetchMessages().then(() => markMessagesAsRead());

    const channel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        const incomingMessage = payload.new as MessageData;

        setMessages(prev => {
          if (prev.some(message => message.id === incomingMessage.id)) {
            return prev;
          }

          return [...prev, incomingMessage];
        });

        if (incomingMessage.sender_type === 'customer') {
          markMessagesAsRead();
        }
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
      const result = await sendWhatsAppMessage(id, msg);

      if (result?.savedMessage) {
        setMessages(prev => {
          if (prev.some(message => message.id === result.savedMessage.id)) {
            return prev;
          }

          return [...prev, result.savedMessage as MessageData];
        });
      }

      fetchConversation();
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
                {/* Image */}
                {msg.message_type === 'image' && msg.media_url && (
                  <div className="mb-1.5">
                    <img
                      src={msg.media_url}
                      alt="Imagem"
                      className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer"
                      onClick={() => window.open(msg.media_url!, '_blank')}
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Audio */}
                {msg.message_type === 'audio' && msg.media_url && (
                  <div className="mb-1.5 min-w-[220px]">
                    <audio controls preload="none" className="w-full h-10 rounded-lg" style={{ filter: msg.sender_type === 'agent' ? 'invert(1) hue-rotate(180deg)' : 'none' }}>
                      <source src={msg.media_url} />
                    </audio>
                  </div>
                )}

                {/* Video */}
                {msg.message_type === 'video' && msg.media_url && (
                  <div className="mb-1.5">
                    <video controls preload="none" className="rounded-lg max-w-full max-h-64">
                      <source src={msg.media_url} />
                    </video>
                  </div>
                )}

                {/* Text content - show if not a media-only message */}
                {msg.content && !(msg.message_type === 'audio' && msg.media_url && !msg.content.trim()) && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}

                {/* Fallback for media without URL */}
                {(['image', 'audio', 'video'].includes(msg.message_type)) && !msg.media_url && !msg.content && (
                  <p className="text-sm leading-relaxed italic opacity-70">
                    {msg.message_type === 'image' ? '📷 Imagem' : msg.message_type === 'audio' ? '🎵 Áudio' : '🎬 Vídeo'}
                  </p>
                )}

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
            <QuickMessages onSelect={(content) => setInput(content)} />
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
      <div className="hidden lg:flex w-80 flex-col border-l border-border bg-card overflow-y-auto">
        {/* Profile Header */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary ring-4 ring-primary/20">
              {conversation.contact_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <span className={`absolute bottom-0 right-1 h-4 w-4 rounded-full border-2 border-card ${conversation.status === 'active' ? 'bg-green-500' : conversation.status === 'pending' ? 'bg-yellow-500' : 'bg-muted-foreground'}`} />
          </div>
          <p className="text-base font-semibold text-card-foreground mt-3">{conversation.contact_name}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{conversation.contact_phone}</p>
          </div>
          <div className="mt-3">
            <StatusBadge status={conversation.status as 'new' | 'pending' | 'active' | 'resolved'} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-px bg-border border-b border-border">
          <div className="flex flex-col items-center py-3 bg-card">
            <span className="text-lg font-bold text-card-foreground">{messages.length}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Mensagens</span>
          </div>
          <div className="flex flex-col items-center py-3 bg-card">
            <span className="text-lg font-bold text-card-foreground">
              {formatDistanceToNow(new Date(conversation.created_at), { locale: ptBR, addSuffix: false })}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Duração</span>
          </div>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* Contact Details */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="h-3 w-3" /> Detalhes do Contato
            </p>
            <div className="space-y-2.5 rounded-lg border border-border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Telefone</span>
                <span className="text-xs font-medium text-card-foreground">{conversation.contact_phone}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Primeira conversa</span>
                <span className="text-xs font-medium text-card-foreground">{format(new Date(conversation.created_at), 'dd/MM/yyyy')}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Última atividade</span>
                <span className="text-xs font-medium text-card-foreground">{format(new Date(conversation.updated_at), 'dd/MM HH:mm')}</span>
              </div>
              {(conversation.ctwa_clid || conversation.source_id || conversation.ad_title) && (
                <>
                  <div className="h-px bg-border" />
                  {conversation.ad_title && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Anúncio</span>
                      <span className="text-xs font-medium text-primary max-w-[140px] truncate" title={conversation.ad_title}>{conversation.ad_title}</span>
                    </div>
                  )}
                  {conversation.ctwa_clid && (
                    <>
                      {conversation.ad_title && <div className="h-px bg-border" />}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">CTWA Click ID</span>
                        <span className="text-[10px] font-mono text-card-foreground max-w-[120px] truncate" title={conversation.ctwa_clid}>{conversation.ctwa_clid}</span>
                      </div>
                    </>
                  )}
                  {conversation.source_id && (
                    <>
                      <div className="h-px bg-border" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Source ID</span>
                        <span className="text-[10px] font-mono text-card-foreground max-w-[120px] truncate" title={conversation.source_id}>{conversation.source_id}</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Assigned Agent */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="h-3 w-3" /> Agente Responsável
            </p>
            <div className="rounded-lg border border-border bg-background/50 p-3">
              {assignedAgent ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {assignedAgent.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-card-foreground">{assignedAgent.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">Atribuído</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs text-muted-foreground">Nenhum agente atribuído</p>
                </div>
              )}
            </div>
          </div>

          {/* Assignment History */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <History className="h-3 w-3" /> Histórico de Atendimento
            </p>
            <div className="rounded-lg border border-border bg-background/50 p-3">
              {assignmentHistory.length > 0 ? (
                <div className="space-y-3">
                  {assignmentHistory.map((h, i) => (
                    <div key={h.id} className="relative flex gap-3">
                      {/* Timeline line */}
                      {i < assignmentHistory.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                      )}
                      {/* Dot */}
                      <div className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
                        !h.unassigned_at ? 'bg-primary/20 ring-2 ring-primary/30' : 'bg-muted'
                      }`}>
                        <div className={`h-2 w-2 rounded-full ${!h.unassigned_at ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <p className="text-xs font-medium text-card-foreground truncate">{h.agent_name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(h.assigned_at), 'dd/MM/yyyy HH:mm')}
                          {h.unassigned_at
                            ? ` → ${format(new Date(h.unassigned_at), 'dd/MM HH:mm')}`
                            : ' — atual'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">Sem histórico</p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Etiquetas
              </p>
              <TagManager
                contactPhone={conversation.contact_phone}
                contactTags={contactTags}
                onTagsChanged={fetchConversation}
              />
            </div>
            <div className="rounded-lg border border-border bg-background/50 p-3">
              {contactTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {contactTags.map(ct => (
                    <span
                      key={ct.id}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                      style={{ backgroundColor: ct.tag.color }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                      {ct.tag.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">Sem etiquetas</p>
              )}
            </div>
          </div>

          {/* Conversation Info */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Conversa
            </p>
            <div className="space-y-2.5 rounded-lg border border-border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">ID</span>
                <span className="text-[10px] font-mono text-card-foreground">{id?.slice(0, 8)}...</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <StatusBadge status={conversation.status as 'new' | 'pending' | 'active' | 'resolved'} />
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Mensagens</span>
                <span className="text-xs font-medium text-card-foreground">{messages.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
