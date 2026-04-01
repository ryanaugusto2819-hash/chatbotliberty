import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  RefreshCw, Search, Eye, RotateCcw, Settings, TrendingUp,
  CheckCircle, XCircle, Clock, Loader2, Send, Save,
  BarChart3, Zap, DollarSign, ShoppingCart,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface ConversionEvent {
  id: string;
  conversation_id: string | null;
  lead_id: string | null;
  order_id: string | null;
  event_name: string;
  event_id: string;
  phone: string | null;
  ctwa_clid: string | null;
  value: number | null;
  currency: string | null;
  status: string;
  payload_json: any;
  response_json: any;
  sent_at: string | null;
  retry_count: number;
  error_message: string | null;
  created_at: string;
}

interface CapiConfig {
  id: string;
  dataset_id: string;
  access_token: string;
  api_version: string;
  graph_base_url: string;
  page_id: string;
  is_active: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-warning/15 text-warning', icon: Clock },
  sent: { label: 'Enviado', color: 'bg-success/15 text-success', icon: CheckCircle },
  failed: { label: 'Falhou', color: 'bg-destructive/15 text-destructive', icon: XCircle },
};

const eventColors: Record<string, string> = {
  Lead: 'bg-info/15 text-info',
  InitiateCheckout: 'bg-warning/15 text-warning',
  Purchase: 'bg-success/15 text-success',
};

export default function ConversionEvents() {
  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventNameFilter, setEventNameFilter] = useState('all');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchOrderId, setSearchOrderId] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [batchRetrying, setBatchRetrying] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ConversionEvent | null>(null);
  const [config, setConfig] = useState<CapiConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configForm, setConfigForm] = useState({
    dataset_id: '',
    access_token: '',
    api_version: 'v21.0',
    graph_base_url: 'https://graph.facebook.com',
    page_id: '',
    is_active: true,
  });

  // Stats
  const totalSent = events.filter(e => e.status === 'sent').length;
  const totalFailed = events.filter(e => e.status === 'failed').length;
  const totalPending = events.filter(e => e.status === 'pending').length;
  const totalValue = events.filter(e => e.status === 'sent' && e.value).reduce((acc, e) => acc + (e.value || 0), 0);

  useEffect(() => {
    fetchEvents();
    fetchConfig();

    const channel = supabase
      .channel('conversion-events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversion_events' }, () => fetchEvents())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('conversion_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) setEvents(data as unknown as ConversionEvent[]);
    setLoading(false);
  };

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('meta_capi_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      const c = data as unknown as CapiConfig;
      setConfig(c);
      setConfigForm({
        dataset_id: c.dataset_id,
        access_token: c.access_token,
        api_version: c.api_version,
        graph_base_url: c.graph_base_url,
        page_id: c.page_id || '',
        is_active: c.is_active,
      });
    }
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      if (config) {
        await supabase
          .from('meta_capi_config')
          .update({ ...configForm, updated_at: new Date().toISOString() })
          .eq('id', config.id);
      } else {
        await supabase.from('meta_capi_config').insert(configForm);
      }
      toast.success('Configuração salva!');
      fetchConfig();
    } catch {
      toast.error('Erro ao salvar configuração');
    }
    setConfigLoading(false);
  };

  const handleRetry = async (eventId: string) => {
    setRetryingId(eventId);
    try {
      const { data, error } = await supabase.functions.invoke('meta-conversions-send', {
        body: { mode: 'retry', conversion_event_id: eventId },
      });
      if (error) throw error;
      toast.success('Evento reenviado!');
      fetchEvents();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
    setRetryingId(null);
  };

  const handleBatchRetry = async () => {
    setBatchRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-conversions-send', {
        body: { mode: 'batch_retry' },
      });
      if (error) throw error;
      toast.success(`Retry em lote: ${(data as any)?.succeeded || 0} sucesso, ${(data as any)?.failed || 0} falhas`);
      fetchEvents();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
    setBatchRetrying(false);
  };

  const filtered = events.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (eventNameFilter !== 'all' && e.event_name !== eventNameFilter) return false;
    if (searchPhone && !e.phone?.includes(searchPhone)) return false;
    if (searchOrderId && !e.event_id?.includes(searchOrderId)) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Conversions API" subtitle="Eventos enviados para a Meta" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Enviados', value: totalSent, icon: CheckCircle, color: 'text-success' },
            { label: 'Falharam', value: totalFailed, icon: XCircle, color: 'text-destructive' },
            { label: 'Pendentes', value: totalPending, icon: Clock, color: 'text-warning' },
            { label: 'Valor Total', value: `R$ ${totalValue.toFixed(2)}`, icon: DollarSign, color: 'text-primary' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events" className="gap-2"><Zap className="h-4 w-4" />Eventos</TabsTrigger>
            <TabsTrigger value="config" className="gap-2"><Settings className="h-4 w-4" />Configuração</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[180px]">
                    <Label className="text-xs mb-1 block text-muted-foreground">Telefone</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} className="pl-9" />
                    </div>
                  </div>
                  <div className="min-w-[140px]">
                    <Label className="text-xs mb-1 block text-muted-foreground">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="sent">Enviados</SelectItem>
                        <SelectItem value="failed">Falharam</SelectItem>
                        <SelectItem value="pending">Pendentes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[160px]">
                    <Label className="text-xs mb-1 block text-muted-foreground">Evento</Label>
                    <Select value={eventNameFilter} onValueChange={setEventNameFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="Lead">Lead</SelectItem>
                        <SelectItem value="InitiateCheckout">InitiateCheckout</SelectItem>
                        <SelectItem value="Purchase">Purchase</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <Label className="text-xs mb-1 block text-muted-foreground">Order/Event ID</Label>
                    <Input placeholder="Buscar..." value={searchOrderId} onChange={(e) => setSearchOrderId(e.target.value)} />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleBatchRetry} disabled={batchRetrying}>
                    {batchRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Retry em Lote
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Zap className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Nenhum evento encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Evento</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Tentativas</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((event) => {
                          const sc = statusConfig[event.status] || statusConfig.pending;
                          const StatusIcon = sc.icon;
                          return (
                            <TableRow key={event.id}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${eventColors[event.event_name] || 'bg-muted text-muted-foreground'}`}>
                                  {event.event_name}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs font-mono">{event.phone || '-'}</TableCell>
                              <TableCell className="text-xs">
                                {event.value ? `${event.currency} ${Number(event.value).toFixed(2)}` : '-'}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {sc.label}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-center">{event.retry_count}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedEvent(event)}>
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle>Detalhes do Evento</DialogTitle>
                                      </DialogHeader>
                                      {selectedEvent && (
                                        <div className="space-y-4">
                                          <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div><span className="text-muted-foreground">Event ID:</span> <span className="font-mono text-xs">{selectedEvent.event_id}</span></div>
                                            <div><span className="text-muted-foreground">Evento:</span> {selectedEvent.event_name}</div>
                                            <div><span className="text-muted-foreground">Telefone:</span> {selectedEvent.phone}</div>
                                            <div><span className="text-muted-foreground">CTWA CLID:</span> <span className="font-mono text-xs">{selectedEvent.ctwa_clid || '-'}</span></div>
                                            <div><span className="text-muted-foreground">Valor:</span> {selectedEvent.value ? `${selectedEvent.currency} ${Number(selectedEvent.value).toFixed(2)}` : '-'}</div>
                                            <div><span className="text-muted-foreground">Status:</span> {selectedEvent.status}</div>
                                            <div><span className="text-muted-foreground">Tentativas:</span> {selectedEvent.retry_count}</div>
                                            <div><span className="text-muted-foreground">Enviado em:</span> {selectedEvent.sent_at ? format(new Date(selectedEvent.sent_at), "dd/MM/yyyy HH:mm:ss") : '-'}</div>
                                          </div>
                                          {selectedEvent.error_message && (
                                            <div>
                                              <Label className="text-xs text-destructive">Erro:</Label>
                                              <pre className="bg-destructive/5 border border-destructive/20 rounded p-3 text-xs overflow-x-auto mt-1">{selectedEvent.error_message}</pre>
                                            </div>
                                          )}
                                          <div>
                                            <Label className="text-xs text-muted-foreground">Payload enviado:</Label>
                                            <pre className="bg-muted rounded p-3 text-xs overflow-x-auto mt-1 max-h-48">{JSON.stringify(selectedEvent.payload_json, null, 2)}</pre>
                                          </div>
                                          {selectedEvent.response_json && (
                                            <div>
                                              <Label className="text-xs text-muted-foreground">Resposta da Meta:</Label>
                                              <pre className="bg-muted rounded p-3 text-xs overflow-x-auto mt-1 max-h-48">{JSON.stringify(selectedEvent.response_json, null, 2)}</pre>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </DialogContent>
                                  </Dialog>
                                  {event.status === 'failed' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-warning"
                                      disabled={retryingId === event.id}
                                      onClick={() => handleRetry(event.id)}
                                    >
                                      {retryingId === event.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuração da Conversions API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Dataset ID</Label>
                    <Input
                      placeholder="Ex: 1234567890"
                      value={configForm.dataset_id}
                      onChange={(e) => setConfigForm(f => ({ ...f, dataset_id: e.target.value }))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">ID do dataset no Events Manager da Meta</p>
                  </div>
                  <div>
                    <Label className="text-xs">Access Token</Label>
                    <Input
                      type="password"
                      placeholder="Token de acesso"
                      value={configForm.access_token}
                      onChange={(e) => setConfigForm(f => ({ ...f, access_token: e.target.value }))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">System User Token com permissão ads_management</p>
                  </div>
                  <div>
                    <Label className="text-xs">Versão da API</Label>
                    <Input
                      placeholder="v21.0"
                      value={configForm.api_version}
                      onChange={(e) => setConfigForm(f => ({ ...f, api_version: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Base URL</Label>
                    <Input
                      placeholder="https://graph.facebook.com"
                      value={configForm.graph_base_url}
                      onChange={(e) => setConfigForm(f => ({ ...f, graph_base_url: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={configForm.is_active}
                    onCheckedChange={(v) => setConfigForm(f => ({ ...f, is_active: v }))}
                  />
                  <Label className="text-sm">Integração ativa</Label>
                </div>
                <Button onClick={handleSaveConfig} disabled={configLoading} className="gap-2">
                  {configLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Configuração
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
