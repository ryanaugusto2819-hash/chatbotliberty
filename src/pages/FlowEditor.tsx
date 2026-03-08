import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import AutomationNode from '@/components/automation/AutomationNode';
import NodeEditor from '@/components/automation/NodeEditor';
import {
  ArrowLeft, Save, MessageSquare, Clock, Image, Music, Video,
  Loader2, FileText, GitFork, Bot, ListOrdered, Play, Pause,
  Settings, Zap, Link2, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

const nodeTypes = { automation: AutomationNode };

const triggerOptions = [
  { value: 'manual', label: 'Disparo Manual', desc: 'O agente inicia manualmente na conversa', icon: '🖱️' },
  { value: 'message_received', label: 'Ao Receber Mensagem', desc: 'Dispara quando qualquer mensagem chega', icon: '📩' },
  { value: 'keyword', label: 'Palavra-chave', desc: 'Dispara com palavras específicas', icon: '🔑' },
  { value: 'new_conversation', label: 'Nova Conversa', desc: 'Quando um novo contato inicia conversa', icon: '🆕' },
  { value: 'scheduled', label: 'Agendado', desc: 'Em horários programados', icon: '⏰' },
];

interface ToolCategory {
  label: string;
  items: { type: string; label: string; icon: React.ElementType; desc: string }[];
}

const toolCategories: ToolCategory[] = [
  {
    label: 'Gatilhos',
    items: [
      { type: 'trigger_manual', label: 'Disparo Manual', icon: Zap, desc: 'O agente inicia manualmente' },
      { type: 'trigger_message_received', label: 'Ao Receber Mensagem', icon: Zap, desc: 'Quando qualquer mensagem chega' },
      { type: 'trigger_keyword', label: 'Palavra-chave', icon: Zap, desc: 'Dispara com palavras específicas' },
      { type: 'trigger_new_conversation', label: 'Nova Conversa', icon: Zap, desc: 'Novo contato inicia conversa' },
      { type: 'trigger_scheduled', label: 'Agendado', icon: Zap, desc: 'Em horários programados' },
    ],
  },
  {
    label: 'Mensagens',
    items: [
      { type: 'message', label: 'Texto', icon: MessageSquare, desc: 'Mensagem de texto simples' },
      { type: 'image', label: 'Imagem', icon: Image, desc: 'Enviar uma imagem' },
      { type: 'audio', label: 'Áudio', icon: Music, desc: 'Enviar um áudio' },
      { type: 'video', label: 'Vídeo', icon: Video, desc: 'Enviar um vídeo' },
      { type: 'document', label: 'Documento', icon: FileText, desc: 'Enviar um arquivo' },
    ],
  },
  {
    label: 'Interação',
    items: [
      { type: 'quick_reply', label: 'Resposta Rápida', icon: ListOrdered, desc: 'Botões de resposta rápida' },
      { type: 'ai_reply', label: 'Resposta IA', icon: Bot, desc: 'Resposta gerada por IA' },
    ],
  },
  {
    label: 'Lógica',
    items: [
      { type: 'delay', label: 'Espera', icon: Clock, desc: 'Aguardar antes de continuar' },
      { type: 'condition', label: 'Condição', icon: GitFork, desc: 'Caminho condicional' },
    ],
  },
];

const allItems = toolCategories.flatMap((c) => c.items);

export default function FlowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [flowActive, setFlowActive] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);

  // Load available WhatsApp connections
  useEffect(() => {
    const loadConnections = async () => {
      const { data } = await supabase
        .from('connection_configs')
        .select('*')
        .eq('is_connected', true);
      if (data) {
        setConnections(data);
        if (data.length === 1) setSelectedConnections([data[0].id]);
      }
    };
    loadConnections();
  }, []);

  useEffect(() => {
    if (id) loadFlow();
  }, [id]);

  const loadFlow = async () => {
    if (!id) return;

    const [flowRes, nodesRes, edgesRes] = await Promise.all([
      supabase.from('automation_flows').select('*').eq('id', id).single(),
      supabase.from('automation_nodes').select('*').eq('flow_id', id).order('sort_order'),
      supabase.from('automation_edges').select('*').eq('flow_id', id),
    ]);

    if (flowRes.data) {
      setFlowName(flowRes.data.name);
      setFlowDescription(flowRes.data.description || '');
      setFlowActive(flowRes.data.is_active);
    }

    if (nodesRes.data && nodesRes.data.length > 0) {
      setNodes(
        nodesRes.data.map((n: any) => ({
          id: n.id,
          type: 'automation',
          position: { x: n.position_x, y: n.position_y },
          data: {
            nodeType: n.node_type,
            label: n.label,
            preview: getPreview(n.node_type, n.config as Record<string, unknown>),
            config: n.config,
          },
          deletable: true,
        }))
      );

      // Load connection IDs from any trigger node
      const triggerNode = nodesRes.data.find((n: any) => n.node_type === 'trigger');
      if (triggerNode) {
        const tc = triggerNode.config as Record<string, unknown>;
        if (tc.connection_ids) {
          setSelectedConnections(tc.connection_ids as string[]);
        } else if (tc.connection_id) {
          setSelectedConnections([tc.connection_id as string]);
        }
      }
    } else {
      // Create a default trigger node
      const triggerNode: Node = {
        id: crypto.randomUUID(),
        type: 'automation',
        position: { x: 300, y: 50 },
        data: { nodeType: 'trigger', label: 'Disparo Manual', config: { trigger_type: 'manual' }, preview: '' },
        deletable: true,
      };
      setNodes([triggerNode]);
    }

    if (edgesRes.data) {
      setEdges(
        edgesRes.data.map((e: any) => ({
          id: e.id,
          source: e.source_node_id,
          target: e.target_node_id,
          animated: true,
          style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        }))
      );
    }

    setLoading(false);
  };

  const getPreview = (type: string, config: Record<string, unknown>): string => {
    if (type === 'message') return (config?.content as string)?.slice(0, 50) || '';
    if (type === 'delay') {
      const val = (config?.delay_value as number) || (config?.delay_seconds as number) || 5;
      const unit = (config?.delay_unit as string) || 'seconds';
      return `${val} ${unit === 'minutes' ? 'min' : unit === 'hours' ? 'h' : 's'}`;
    }
    if (type === 'image' || type === 'video' || type === 'document') return (config?.caption as string) || '';
    if (type === 'audio') return config?.media_url ? 'Áudio anexado' : '';
    if (type === 'quick_reply') return (config?.content as string)?.slice(0, 40) || '';
    if (type === 'ai_reply') return (config?.ai_prompt as string)?.slice(0, 40) || '';
    if (type === 'condition') return `${config?.condition_field || ''} ${config?.condition_operator || ''} ${config?.condition_value || ''}`;
    return '';
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge({ ...params, animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } }, eds)
      );
    },
    [setEdges]
  );

  const addNode = (type: string) => {
    // Determine actual nodeType and default config for trigger subtypes
    let actualType = type;
    const defaultConfig: Record<string, unknown> = {};
    let label = '';

    if (type.startsWith('trigger_')) {
      actualType = 'trigger';
      const triggerSubtype = type.replace('trigger_', '');
      defaultConfig.trigger_type = triggerSubtype;
      defaultConfig.connection_ids = selectedConnections;
      label = triggerOptions.find(t => t.value === triggerSubtype)?.label || 'Gatilho';

      // Position triggers side by side at top
      const triggerNodes = nodes.filter(n => (n.data.nodeType as string) === 'trigger');
      const xPos = triggerNodes.length > 0
        ? Math.max(...triggerNodes.map(n => n.position.x)) + 300
        : 300;

      const newNode: Node = {
        id: crypto.randomUUID(),
        type: 'automation',
        position: { x: xPos, y: 50 },
        data: { nodeType: actualType, label, config: defaultConfig, preview: '' },
        deletable: true,
      };
      setNodes((nds) => [...nds, newNode]);
      return;
    }

    const item = allItems.find((b) => b.type === type);
    if (type === 'delay') { defaultConfig.delay_value = 5; defaultConfig.delay_unit = 'seconds'; }
    if (type === 'condition') { defaultConfig.condition_field = 'last_message'; defaultConfig.condition_operator = 'equals'; }

    const lastNode = nodes[nodes.length - 1];
    const yPos = lastNode ? lastNode.position.y + 160 : 200;
    const xPos = lastNode ? lastNode.position.x : 300;

    const newNode: Node = {
      id: crypto.randomUUID(),
      type: 'automation',
      position: { x: xPos, y: yPos },
      data: {
        nodeType: type,
        label: item?.label || type,
        config: defaultConfig,
        preview: getPreview(type, defaultConfig),
      },
    };

    setNodes((nds) => [...nds, newNode]);

    if (lastNode) {
      const newEdge: Edge = {
        id: `e-${lastNode.id}-${newNode.id}`,
        source: lastNode.id,
        target: newNode.id,
        animated: true,
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      };
      setEdges((eds) => [...eds, newEdge]);
    }
  };

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  const handleNodeSave = (nodeId: string, label: string, config: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label,
                config,
                preview: getPreview(n.data.nodeType as string, config),
              },
            }
          : n
      )
    );
  };

  const handleNodeDelete = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  const toggleActive = async () => {
    if (!id) return;
    const next = !flowActive;
    await supabase.from('automation_flows').update({ is_active: next }).eq('id', id);
    setFlowActive(next);
    toast.success(next ? 'Fluxo ativado' : 'Fluxo desativado');
  };

  const saveFlow = async () => {
    if (!id) return;
    setSaving(true);

    await supabase
      .from('automation_flows')
      .update({ name: flowName, description: flowDescription })
      .eq('id', id);

    // Inject connection_ids into all trigger nodes before saving
    const updatedNodes = nodes.map((n) =>
      (n.data.nodeType as string) === 'trigger'
        ? {
            ...n,
            data: {
              ...n.data,
              config: {
                ...(n.data.config as Record<string, unknown>),
                connection_ids: selectedConnections,
                connection_id: selectedConnections[0] || '',
              },
            },
          }
        : n
    );

    await supabase.from('automation_edges').delete().eq('flow_id', id);
    await supabase.from('automation_nodes').delete().eq('flow_id', id);

    if (updatedNodes.length > 0) {
      const nodeInserts = updatedNodes.map((n, i) => ({
        id: n.id,
        flow_id: id,
        node_type: n.data.nodeType as string,
        label: n.data.label as string,
        config: JSON.parse(JSON.stringify((n.data.config as Record<string, unknown>) || {})),
        position_x: n.position.x,
        position_y: n.position.y,
        sort_order: i,
      }));

      const { error: nodesError } = await supabase.from('automation_nodes').insert(nodeInserts);
      if (nodesError) {
        console.error('Error saving nodes:', nodesError);
        toast.error('Erro ao salvar nós');
        setSaving(false);
        return;
      }
    }

    if (edges.length > 0) {
      const edgeInserts = edges.map((e) => ({
        id: crypto.randomUUID(),
        flow_id: id,
        source_node_id: e.source,
        target_node_id: e.target,
      }));

      const { error: edgesError } = await supabase.from('automation_edges').insert(edgeInserts);
      if (edgesError) {
        console.error('Error saving edges:', edgesError);
        toast.error('Erro ao salvar conexões');
        setSaving(false);
        return;
      }
    }

    toast.success('Fluxo salvo com sucesso');
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/automation')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-sm font-bold text-card-foreground bg-transparent border-none focus:outline-none w-48"
              placeholder="Nome do fluxo"
            />
            <input
              value={flowDescription}
              onChange={(e) => setFlowDescription(e.target.value)}
              className="text-[11px] text-muted-foreground bg-transparent border-none focus:outline-none w-64"
              placeholder="Descrição do fluxo..."
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleActive}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              flowActive
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            {flowActive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {flowActive ? 'Ativo' : 'Inativo'}
          </button>
          <button
            onClick={saveFlow}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </div>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-card flex flex-col shrink-0 overflow-y-auto">
          {/* === SETTINGS SECTION === */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <p className="text-xs font-bold text-card-foreground">Configurações</p>
            </div>
            {showSettings ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {showSettings && (
            <div className="border-b border-border bg-secondary/20 p-3 space-y-4">
              {/* Connection selector - Multi Select */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conexões WhatsApp</label>
                </div>
                {connections.length > 0 ? (
                  <div className="space-y-1">
                    {connections.map((c) => {
                      const isSelected = selectedConnections.includes(c.id);
                      const connLabel = (c.config as any)?.phone_number_id
                        ? `WhatsApp (${(c.config as any).phone_number_id})`
                        : c.connection_id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedConnections(prev =>
                            isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                          )}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/50'
                              : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                              isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                            }`}>
                              {isSelected && <span className="text-[8px] text-primary-foreground font-bold">✓</span>}
                            </div>
                            <p className="text-[11px] font-semibold text-card-foreground">{connLabel}</p>
                          </div>
                        </button>
                      );
                    })}
                    <p className="text-[9px] text-muted-foreground">
                      {selectedConnections.length} conexão{selectedConnections.length !== 1 ? 'ões' : ''} selecionada{selectedConnections.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Nenhuma conexão configurada</p>
                    <button
                      onClick={() => navigate('/connections')}
                      className="mt-1 text-[10px] font-semibold text-primary hover:underline"
                    >
                      Configurar conexão →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === COMPONENTS SECTION === */}
          <div className="p-3 border-b border-border">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Componentes</p>
          </div>
          {toolCategories.map((cat) => (
            <div key={cat.label} className="border-b border-border">
              <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {cat.label}
              </p>
              <div className="px-2 pb-2 space-y-0.5">
                {cat.items.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => addNode(item.type)}
                    className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left hover:bg-secondary transition-colors group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors">
                      <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-card-foreground">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
            }}
          >
            <Controls className="!bg-card !border-border !shadow-md !rounded-xl [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button]:!rounded-lg" />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="hsl(var(--border))" />
            <MiniMap
              className="!bg-card !border-border !rounded-xl !shadow-md"
              maskColor="hsl(var(--background) / 0.7)"
              nodeColor="hsl(var(--primary))"
            />

            {/* Node count panel */}
            <Panel position="top-right" className="!m-3">
              <div className="rounded-lg bg-card border border-border px-3 py-1.5 shadow-sm">
                <span className="text-[11px] text-muted-foreground">
                  {nodes.length} nós · {edges.length} conexões
                </span>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Node editor panel */}
        {selectedNode && (
          <NodeEditor
            nodeId={selectedNode.id}
            nodeType={selectedNode.data.nodeType as string}
            label={selectedNode.data.label as string}
            config={(selectedNode.data.config as Record<string, unknown>) || {}}
            onSave={handleNodeSave}
            onDelete={handleNodeDelete}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
