import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Save, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface AiConfig {
  enabled: boolean;
  system_prompt: string;
}

const defaultPrompt =
  'Você é um assistente virtual amigável de atendimento ao cliente via WhatsApp. Responda de forma concisa, útil e educada em português brasileiro. Se não souber a resposta, diga que vai encaminhar para um atendente humano.';

export default function AiSettings() {
  const [config, setConfig] = useState<AiConfig>({ enabled: false, system_prompt: defaultPrompt });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('connection_configs')
      .select('config')
      .eq('connection_id', 'ai-auto-reply')
      .maybeSingle();

    if (data?.config) {
      const c = data.config as Record<string, unknown>;
      setConfig({
        enabled: !!c.enabled,
        system_prompt: (c.system_prompt as string) || defaultPrompt,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('connection_configs')
      .update({
        config: { enabled: config.enabled, system_prompt: config.system_prompt },
        updated_at: new Date().toISOString(),
      })
      .eq('connection_id', 'ai-auto-reply');

    if (error) {
      toast.error('Erro ao salvar configurações');
      console.error(error);
    } else {
      toast.success('Configurações salvas com sucesso');
    }
    setSaving(false);
  };

  const toggleEnabled = () => {
    setConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  if (loading) {
    return (
      <div>
        <TopBar title="Integração IA" subtitle="Chatbot inteligente com IA" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Integração IA" subtitle="Chatbot inteligente com IA" />
      <div className="p-6 max-w-2xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-border bg-card p-6 shadow-elevated"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Bot className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">Resposta Automática com IA</p>
              <p className="text-xs text-muted-foreground">
                Responde automaticamente mensagens de clientes usando inteligência artificial
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4 mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Ativar respostas automáticas</p>
                <p className="text-xs text-muted-foreground">
                  A IA responderá automaticamente todas as mensagens recebidas
                </p>
              </div>
            </div>
            <button
              onClick={toggleEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                config.enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  config.enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* System Prompt */}
          <div className="space-y-2 mb-6">
            <label className="text-sm font-medium text-foreground">Prompt do Sistema</label>
            <p className="text-xs text-muted-foreground">
              Instruções que definem como a IA deve se comportar e responder
            </p>
            <textarea
              value={config.system_prompt}
              onChange={(e) => setConfig((prev) => ({ ...prev, system_prompt: e.target.value }))}
              rows={6}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configurações
          </button>
        </motion.div>
      </div>
    </div>
  );
}
