import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink, Bot, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AutoReplyLog {
  id: string;
  conversation_id: string | null;
  function_name: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  created_at: string;
  contact_name?: string;
  contact_phone?: string;
  ai_message?: string;
}

interface Props {
  nicheId: string;
}

export default function AutoReplyLogs({ nicheId }: Props) {
  const [logs, setLogs] = useState<AutoReplyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLogs();
  }, [nicheId]);

  const fetchLogs = async () => {
    setLoading(true);

    try {
      const { data: usageLogs, error: logsError } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('function_name', 'ai-auto-reply')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) {
        console.error('Error fetching ai_usage_logs:', logsError);
        setLogs([]);
        setLoading(false);
        return;
      }

      if (!usageLogs || usageLogs.length === 0) {
        setLogs([]);
        setLoading(false);
        return;
      }

      const convoIds = [...new Set(usageLogs.map(l => l.conversation_id).filter(Boolean))] as string[];

      // Fetch conversations and AI messages in parallel
      const [convosResult, messagesResult] = await Promise.all([
        supabase
          .from('conversations')
          .select('id, contact_name, contact_phone, niche_id')
          .in('id', convoIds),
        supabase
          .from('messages')
          .select('conversation_id, content, created_at, sender_label')
          .in('conversation_id', convoIds)
          .eq('sender_type', 'agent')
          .is('sender_label', null)
          .order('created_at', { ascending: false }),
      ]);

      const convoMap = new Map((convosResult.data || []).map(c => [c.id, c]));

      // Group AI messages by conversation_id with timestamps
      const aiMessages = messagesResult.data || [];

      const enriched = usageLogs
        .filter(log => {
          if (!log.conversation_id) return false;
          const convo = convoMap.get(log.conversation_id);
          return convo?.niche_id === nicheId;
        })
        .map(log => {
          const convo = log.conversation_id ? convoMap.get(log.conversation_id) : null;
          // Find the AI message closest to the log timestamp
          const logTime = new Date(log.created_at).getTime();
          const matchingMsg = aiMessages.find(m => {
            if (m.conversation_id !== log.conversation_id) return false;
            const msgTime = new Date(m.created_at).getTime();
            return Math.abs(msgTime - logTime) < 30_000; // within 30s
          });
          return {
            ...log,
            contact_name: convo?.contact_name,
            contact_phone: convo?.contact_phone,
            ai_message: matchingMsg?.content,
          };
        });

      setLogs(enriched);
    } catch (err) {
      console.error('Error in fetchLogs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhum log de resposta automática</p>
        <p className="text-xs mt-1">Os logs aparecerão aqui quando a IA responder automaticamente</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground">
          Últimas {logs.length} respostas automáticas
        </p>
        <button
          onClick={fetchLogs}
          className="text-xs text-primary hover:underline"
        >
          Atualizar
        </button>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {logs.map((log) => {
          const isExpanded = expandedId === log.id;
          return (
            <div
              key={log.id}
              className="rounded-lg border border-border bg-background text-sm overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {log.contact_name || log.contact_phone || 'Conversa desconhecida'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      <span className="text-muted-foreground/60">•</span>
                      <span>{log.total_tokens} tokens</span>
                      <span className="text-muted-foreground/60">•</span>
                      <span className="text-xs opacity-60">{log.model.split('/').pop()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {log.conversation_id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/conversations/${log.conversation_id}`);
                      }}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                      title="Abrir conversa"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-0">
                  <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground whitespace-pre-wrap border-l-2 border-primary/40">
                    {log.ai_message || (
                      <span className="text-muted-foreground italic">Mensagem não encontrada</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
