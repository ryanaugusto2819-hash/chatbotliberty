import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageSquare, ExternalLink, Bot, Clock, SkipForward } from 'lucide-react';
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
}

interface Props {
  nicheId: string;
}

export default function AutoReplyLogs({ nicheId }: Props) {
  const [logs, setLogs] = useState<AutoReplyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLogs();
  }, [nicheId]);

  const fetchLogs = async () => {
    setLoading(true);

    try {
      // First, get ALL auto-reply logs (without filtering by conversation)
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

      // Get conversation IDs from logs to enrich with contact info
      const convoIds = [...new Set(usageLogs.map(l => l.conversation_id).filter(Boolean))] as string[];

      // Get conversations for this niche (for filtering) and contact info
      const { data: convos } = await supabase
        .from('conversations')
        .select('id, contact_name, contact_phone, niche_id')
        .in('id', convoIds);

      const convoMap = new Map((convos || []).map(c => [c.id, c]));

      // Filter logs by niche (match conversation's niche_id)
      const enriched = usageLogs
        .filter(log => {
          if (!log.conversation_id) return false;
          const convo = convoMap.get(log.conversation_id);
          return convo?.niche_id === nicheId;
        })
        .map(log => {
          const convo = log.conversation_id ? convoMap.get(log.conversation_id) : null;
          return {
            ...log,
            contact_name: convo?.contact_name,
            contact_phone: convo?.contact_phone,
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
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm"
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

            {log.conversation_id && (
              <button
                onClick={() => navigate(`/conversations/${log.conversation_id}`)}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors shrink-0"
                title="Abrir conversa"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
