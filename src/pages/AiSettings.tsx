import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Save, Loader2, Sparkles, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface AiConfig {
  enabled: boolean;
  system_prompt: string;
}

interface FlowSelectorConfig {
  enabled: boolean;
}

const defaultPrompt =
  'Você é um assistente virtual amigável de atendimento ao cliente via WhatsApp. Responda de forma concisa, útil e educada em português brasileiro. Se não souber a resposta, diga que vai encaminhar para um atendente humano.';

export default function AiSettings() {
  const [config, setConfig] = useState<AiConfig>({ enabled: false, system_prompt: defaultPrompt });
  const [flowSelector, setFlowSelector] = useState<FlowSelectorConfig>({ enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const [autoReply, flowSel] = await Promise.all([
      supabase
        .from('connection_configs')
        .select('config')
        .eq('connection_id', 'ai-auto-reply')
        .maybeSingle(),
      supabase
        .from('connection_configs')
        .select('config')
        .eq('connection_id', 'ai-flow-selector')
        .maybeSingle(),
    ]);

    if (autoReply.data?.config) {
      const c = autoReply.data.config as Record<string, unknown>;
      setConfig({
        enabled: !!c.enabled,
        system_prompt: (c.system_prompt as string) || defaultPrompt,
      });
    }

    if (flowSel.data?.config) {
      const c = flowSel.data.config as Record<string, unknown>;
      setFlowSelector({ enabled: !!c.enabled });
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const [r1, r2] = await Promise.all([
      supabase
        .from('connection_configs')
        .update({
          config: { enabled: config.enabled, system_prompt: config.system_prompt },
          updated_at: new Date().toISOString(),
        })
        .eq('connection_id', 'ai-auto-reply'),
      supabase
        .from('connection_configs')
        .update({
          config: { enabled: flowSelector.enabled },
          updated_at: new Date().toISOString(),
        })
        .eq('connection_id', 'ai-flow-selector'),
    ]);

    if (r1.error || r2.error) {
      toast.error('Erro ao salvar configurações');
      console.error(r1.error, r2.error);
    } else {
      toast.success('Configurações salvas com sucesso');
    }
    setSaving(false);
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
        {/* Auto-reply Section */}
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
              onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
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
        </motion.div>

        {/* Flow Selector Section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-6 shadow-elevated"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <GitBranch className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">Selecionador de Fluxo por IA</p>
              <p className="text-xs text-muted-foreground">
                A IA analisa a mensagem do cliente e dispara automaticamente o fluxo de automação mais adequado
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4 mb-4">
            <div className="flex items-center gap-3">
              <GitBranch className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Ativar seleção automática de fluxo</p>
                <p className="text-xs text-muted-foreground">
                  A cada mensagem recebida, a IA decide se deve disparar um fluxo
                </p>
              </div>
            </div>
            <button
              onClick={() => setFlowSelector((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                flowSelector.enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  flowSelector.enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Como funciona:</strong> A IA lê o nome e descrição dos seus fluxos ativos
              e, com base no contexto da conversa, seleciona e executa o fluxo mais adequado. Se nenhum fluxo se encaixar, nada é disparado.
              Certifique-se de que seus fluxos tenham nomes e descrições claras.
            </p>
          </div>
        </motion.div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}
