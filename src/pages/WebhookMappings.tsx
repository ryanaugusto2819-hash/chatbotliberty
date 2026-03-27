import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/integrations/supabase/client';
import { Webhook, Plus, Trash2, Loader2, Copy, Check, Link2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface FlowOption {
  id: string;
  name: string;
  is_active: boolean;
}

interface Mapping {
  id: string;
  status_key: string;
  label: string;
  flow_id: string | null;
  is_active: boolean;
}

export default function WebhookMappings() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newStatusKey, setNewStatusKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-trigger`;

  const fetchData = async () => {
    const [{ data: m }, { data: f }] = await Promise.all([
      supabase.from('webhook_flow_mappings').select('*').order('created_at'),
      supabase.from('automation_flows').select('id, name, is_active').order('name'),
    ]);
    setMappings((m as Mapping[]) || []);
    setFlows(f || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const addMapping = async () => {
    if (!newStatusKey.trim()) {
      toast.error('Informe a chave do status');
      return;
    }
    const { error } = await supabase.from('webhook_flow_mappings').insert({
      status_key: newStatusKey.trim(),
      label: newLabel.trim() || newStatusKey.trim(),
    });
    if (error) {
      if (error.code === '23505') toast.error('Essa chave de status já existe');
      else toast.error('Erro ao adicionar');
      return;
    }
    setNewStatusKey('');
    setNewLabel('');
    fetchData();
    toast.success('Mapeamento adicionado');
  };

  const updateMapping = async (id: string, updates: Partial<Mapping>) => {
    setSaving(id);
    const { error } = await supabase
      .from('webhook_flow_mappings')
      .update(updates)
      .eq('id', id);
    if (error) toast.error('Erro ao salvar');
    else {
      setMappings(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    }
    setSaving(null);
  };

  const deleteMapping = async (id: string) => {
    const { error } = await supabase.from('webhook_flow_mappings').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      setMappings(prev => prev.filter(m => m.id !== id));
      toast.success('Removido');
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div>
      <TopBar title="Webhook → Fluxo" subtitle="Configure qual fluxo dispara para cada status do webhook" />
      <div className="p-6 space-y-6 max-w-3xl">
        {/* Webhook URL */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Link2 className="h-4 w-4 text-primary" />
            URL do Webhook
          </div>
          <p className="text-xs text-muted-foreground">
            Envie um POST para esta URL com <code className="bg-muted px-1 py-0.5 rounded text-[11px]">phone</code>, <code className="bg-muted px-1 py-0.5 rounded text-[11px]">name</code> (opcional) e <code className="bg-muted px-1 py-0.5 rounded text-[11px]">status</code>.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground break-all select-all">
              {webhookUrl}
            </code>
            <button
              onClick={copyUrl}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary transition-colors"
            >
              {copiedUrl ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Exemplo de payload</summary>
            <pre className="mt-2 rounded-lg bg-muted p-3 text-[11px] text-foreground overflow-x-auto">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "phone": "5511999999999",
  "name": "João Silva",
  "status": "pedido_enviado"
}`}
            </pre>
          </details>
        </div>

        {/* Add new mapping */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Adicionar Mapeamento</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Chave do status (ex: pedido_enviado)"
              value={newStatusKey}
              onChange={(e) => setNewStatusKey(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Label (ex: Pedido Enviado)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={addMapping}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>
        </div>

        {/* Mappings list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Webhook className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum mapeamento criado</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione um status e vincule a um fluxo de automação</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mappings.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{m.label || m.status_key}</p>
                    <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      status: "{m.status_key}"
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateMapping(m.id, { is_active: !m.is_active })}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                        m.is_active ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {m.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                    <button
                      onClick={() => deleteMapping(m.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fluxo vinculado</label>
                  <select
                    value={m.flow_id || ''}
                    onChange={(e) => updateMapping(m.id, { flow_id: e.target.value || null })}
                    disabled={saving === m.id}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="">— Nenhum fluxo —</option>
                    {flows.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.is_active ? '' : '(inativo)'}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
