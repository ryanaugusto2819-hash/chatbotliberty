import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/integrations/supabase/client';
import { Webhook, Plus, Trash2, Loader2, Copy, Check, Link2, History, CheckCircle2, XCircle, AlertTriangle, RefreshCw, GripVertical, Zap, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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

interface WebhookLog {
  id: string;
  status_key: string;
  phone: string;
  contact_name: string;
  payload: Record<string, unknown>;
  mapping_found: boolean;
  flow_id: string | null;
  conversation_id: string | null;
  result: Record<string, unknown>;
  error: string | null;
  success: boolean;
  created_at: string;
}

export default function WebhookMappings() {
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStatusKey, setNewStatusKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newFlowId, setNewFlowId] = useState('');
  const [connectionLabels, setConnectionLabels] = useState<Record<string, string>>({});

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

  const fetchLogs = async () => {
    setLogsLoading(true);
    const [{ data }, { data: connData }] = await Promise.all([
      supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('connection_configs').select('id, label'),
    ]);
    setLogs((data as WebhookLog[]) || []);
    const labels: Record<string, string> = {};
    (connData || []).forEach((c: any) => { labels[c.id] = c.label; });
    setConnectionLabels(labels);
    setLogsLoading(false);
  };

  const getConnectionLabel = (conversationId: string | null) => {
    const log = logs.find(l => l.conversation_id === conversationId);
    if (!log?.result) return null;
    const result = log.result as any;
    const connId = result?.conversationConnectionConfigId;
    if (connId && connectionLabels[connId]) return connectionLabels[connId];
    return null;
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
      flow_id: newFlowId || null,
    });
    if (error) {
      if (error.code === '23505') toast.error('Essa chave de status já existe');
      else toast.error('Erro ao adicionar');
      return;
    }
    setNewStatusKey('');
    setNewLabel('');
    setNewFlowId('');
    setShowAddDialog(false);
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
      toast.success('Salvo');
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

  const getFlowName = (flowId: string | null) => {
    if (!flowId) return '—';
    const flow = flows.find(f => f.id === flowId);
    return flow ? flow.name : flowId.slice(0, 8);
  };

  return (
    <div>
      <TopBar title="Webhook → Fluxo" subtitle="Configure qual fluxo dispara para cada status do webhook" />
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Webhook URL */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Link2 className="h-4 w-4 text-primary" />
            URL do Webhook
          </div>
          <p className="text-xs text-muted-foreground">
            Envie um POST para esta URL com os campos do pedido. Campos obrigatórios: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">telefone</code> e <code className="bg-muted px-1 py-0.5 rounded text-[11px]">status_envio</code>.
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
  "id": "uuid-do-pedido",
  "nome": "João Silva",
  "telefone": "5511999999999",
  "produto": "Nome do produto",
  "status_envio": "enviado",
  "codigo_rastreamento": "AB123456789BR",
  "valor": 100,
  "cidade": "São Paulo",
  "departamento": "SP",
  "pais": "BR",
  "cedula": "12345678900",
  "email": "joao@exemplo.com"
}`}
            </pre>
          </details>
        </div>

        <Tabs defaultValue="mappings" onValueChange={(v) => { if (v === 'logs') fetchLogs(); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mappings" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Mapeamentos
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mappings" className="space-y-4 mt-4">
            {/* Header with add button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-card-foreground">Status → Fluxo</p>
                <p className="text-xs text-muted-foreground mt-0.5">Cada status de pedido dispara um fluxo diferente</p>
              </div>
              <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo Mapeamento
              </Button>
            </div>

            {/* Mappings Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border bg-card/50">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Zap className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-card-foreground">Nenhum mapeamento criado</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Adicione um status do pedido e vincule a um fluxo de automação para disparar automaticamente
                </p>
                <Button onClick={() => setShowAddDialog(true)} size="sm" className="mt-4 gap-1.5">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Mapeamento
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center px-4 py-2.5 bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Status do Pedido</span>
                  <span>Fluxo Vinculado</span>
                  <span className="text-center">Ativo</span>
                  <span className="text-center w-8"></span>
                </div>

                {/* Table rows */}
                <AnimatePresence>
                  {mappings.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors group"
                    >
                      {/* Status key + label */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{m.label || m.status_key}</p>
                        <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          {m.status_key}
                        </code>
                      </div>

                      {/* Flow selector */}
                      <div className="min-w-0">
                        <Select
                          value={m.flow_id || 'none'}
                          onValueChange={(val) => updateMapping(m.id, { flow_id: val === 'none' ? null : val })}
                          disabled={saving === m.id}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecione um fluxo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">— Nenhum fluxo —</span>
                            </SelectItem>
                            {flows.map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                <div className="flex items-center gap-2">
                                  <span>{f.name}</span>
                                  {!f.is_active && (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0">inativo</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Active toggle */}
                      <div className="flex justify-center">
                        <Switch
                          checked={m.is_active}
                          onCheckedChange={(checked) => updateMapping(m.id, { is_active: checked })}
                          disabled={saving === m.id}
                        />
                      </div>

                      {/* Delete */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => deleteMapping(m.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-card-foreground">Últimas 50 chamadas</p>
              <button
                onClick={fetchLogs}
                disabled={logsLoading}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum webhook recebido ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Quando um webhook for enviado, aparecerá aqui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors"
                    >
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : log.mapping_found ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground">
                            {log.status_key || '—'}
                          </code>
                          <span className="text-xs text-muted-foreground truncate">
                            {log.phone || 'sem telefone'}
                          </span>
                          {log.contact_name && (
                            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                              • {log.contact_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </span>
                    </button>

                    {expandedLog === log.id && (
                      <div className="border-t border-border p-3 space-y-3 bg-muted/30">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Status:</span>{' '}
                            <span className={log.success ? 'text-green-500 font-medium' : 'text-destructive font-medium'}>
                              {log.success ? 'Sucesso' : 'Falha'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Mapeamento:</span>{' '}
                            <span className="text-foreground">{log.mapping_found ? 'Encontrado' : 'Não encontrado'}</span>
                          </div>
                          {log.flow_id && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Fluxo:</span>{' '}
                              <span className="text-foreground">{getFlowName(log.flow_id)}</span>
                            </div>
                          )}
                          {log.error && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Erro:</span>{' '}
                              <span className="text-destructive">{log.error}</span>
                            </div>
                          )}
                        </div>
                        <details>
                          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">Payload recebido</summary>
                          <pre className="mt-1 rounded-lg bg-muted p-2 text-[10px] text-foreground overflow-x-auto max-h-40">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </details>
                        <details>
                          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">Resultado</summary>
                          <pre className="mt-1 rounded-lg bg-muted p-2 text-[10px] text-foreground overflow-x-auto max-h-40">
                            {JSON.stringify(log.result, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Mapping Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Novo Mapeamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Chave do status <span className="text-destructive">*</span></Label>
              <Input
                placeholder="ex: pedido_enviado"
                value={newStatusKey}
                onChange={(e) => setNewStatusKey(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Valor que será enviado no campo <code className="bg-muted px-1 py-0.5 rounded">status_envio</code> do webhook
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome amigável</Label>
              <Input
                placeholder="ex: Pedido Enviado"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fluxo a disparar</Label>
              <Select value={newFlowId} onValueChange={setNewFlowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fluxo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">— Definir depois —</span>
                  </SelectItem>
                  {flows.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex items-center gap-2">
                        <span>{f.name}</span>
                        {!f.is_active && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">inativo</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={addMapping} disabled={!newStatusKey.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
