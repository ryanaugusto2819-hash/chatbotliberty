import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Save, Loader2, Sparkles, GitBranch, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface AiConfig {
  enabled: boolean;
  system_prompt: string;
}

interface FlowSelectorConfig {
  enabled: boolean;
  instructions: string;
}

interface FlowItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

const defaultPrompt =
  'Você é um assistente virtual amigável de atendimento ao cliente via WhatsApp. Responda de forma concisa, útil e educada em português brasileiro. Se não souber a resposta, diga que vai encaminhar para um atendente humano.';

const defaultSelectorInstructions =
  'Analise a mensagem do cliente e selecione o fluxo mais adequado. Só selecione um fluxo se realmente fizer sentido para a mensagem. Se nenhum se encaixar, não dispare nada.';

export default function AiSettings() {
  const [config, setConfig] = useState<AiConfig>({ enabled: false, system_prompt: defaultPrompt });
  const [flowSelector, setFlowSelector] = useState<FlowSelectorConfig>({ enabled: false, instructions: defaultSelectorInstructions });
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [editingFlow, setEditingFlow] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const [autoReply, flowSel, flowsData] = await Promise.all([
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
      supabase
        .from('automation_flows')
        .select('id, name, description, is_active')
        .order('is_active', { ascending: false })
        .order('name', { ascending: true }),
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
      setFlowSelector({
        enabled: !!c.enabled,
        instructions: (c.instructions as string) || defaultSelectorInstructions,
      });
    }

    setFlows(flowsData.data || []);
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
          config: { enabled: flowSelector.enabled, instructions: flowSelector.instructions },
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

  const startEditDesc = (flow: FlowItem) => {
    setEditingFlow(flow.id);
    setEditDesc(flow.description || '');
  };

  const saveFlowDesc = async (flowId: string) => {
    const { error } = await supabase
      .from('automation_flows')
      .update({ description: editDesc })
      .eq('id', flowId);

    if (error) {
      toast.error('Erro ao salvar descrição');
    } else {
      setFlows((prev) => prev.map((f) => (f.id === flowId ? { ...f, description: editDesc } : f)));
      toast.success('Descrição atualizada');
    }
    setEditingFlow(null);
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

          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4 mb-6">
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

          {/* Instructions */}
          <div className="space-y-2 mb-6">
            <label className="text-sm font-medium text-foreground">Instruções para a IA</label>
            <p className="text-xs text-muted-foreground">
              Orientações adicionais sobre como a IA deve decidir qual fluxo disparar
            </p>
            <textarea
              value={flowSelector.instructions}
              onChange={(e) => setFlowSelector((prev) => ({ ...prev, instructions: e.target.value }))}
              rows={4}
              placeholder="Ex: Priorize o fluxo de vendas quando o cliente perguntar sobre preços..."
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Flows list */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Fluxos e Descrições</label>
            <p className="text-xs text-muted-foreground mb-3">
              A IA usa o nome e a descrição de cada fluxo para decidir quando ativá-lo. Adicione descrições claras.
            </p>

            {flows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">Nenhum fluxo criado. Crie fluxos na página de Automações.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {flows.map((flow) => (
                  <div
                    key={flow.id}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground">{flow.name}</span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          flow.is_active
                            ? 'bg-primary/10 text-primary'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {flow.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    {editingFlow === flow.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Descreva quando este fluxo deve ser ativado..."
                          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveFlowDesc(flow.id);
                            if (e.key === 'Escape') setEditingFlow(null);
                          }}
                        />
                        <button
                          onClick={() => saveFlowDesc(flow.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingFlow(null)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 mt-1">
                        <p className="text-xs text-muted-foreground flex-1">
                          {flow.description || (
                            <span className="italic text-destructive/70">Sem descrição — a IA não saberá quando usar este fluxo</span>
                          )}
                        </p>
                        <button
                          onClick={() => startEditDesc(flow)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar descrição"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 mt-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Dica:</strong> Quanto mais clara a descrição do fluxo, melhor a IA acerta.
              Ex: "Ativar quando o cliente perguntar sobre preços, planos ou valores dos serviços."
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
