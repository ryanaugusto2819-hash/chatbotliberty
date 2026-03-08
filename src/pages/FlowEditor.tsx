import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import AutomationNode from '@/components/automation/AutomationNode';
import NodeEditor from '@/components/automation/NodeEditor';
import { ArrowLeft, Save, MessageSquare, Clock, Image, Music, Video, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

const nodeTypes = { automation: AutomationNode };

const addButtons = [
  { type: 'message', label: 'Mensagem', icon: MessageSquare },
  { type: 'delay', label: 'Delay', icon: Clock },
  { type: 'image', label: 'Imagem', icon: Image },
  { type: 'audio', label: 'Áudio', icon: Music },
  { type: 'video', label: 'Vídeo', icon: Video },
];

export default function FlowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

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
        }))
      );
    } else {
      // Create default trigger node
      const triggerNode: Node = {
        id: 'trigger-' + crypto.randomUUID(),
        type: 'automation',
        position: { x: 250, y: 50 },
        data: { nodeType: 'trigger', label: 'Início do Fluxo', config: {} },
        deletable: false,
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
          style: { stroke: 'hsl(var(--primary))' },
        }))
      );
    }

    setLoading(false);
  };

  const getPreview = (type: string, config: Record<string, unknown>): string => {
    if (type === 'message') return (config?.content as string)?.slice(0, 40) || '';
    if (type === 'delay') return `${config?.delay_seconds || 5}s de espera`;
    if (type === 'image' || type === 'video') return (config?.caption as string) || 'Mídia';
    if (type === 'audio') return 'Áudio';
    return '';
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge({ ...params, animated: true, style: { stroke: 'hsl(var(--primary))' } }, eds)
      );
    },
    [setEdges]
  );

  const addNode = (type: string) => {
    const lastNode = nodes[nodes.length - 1];
    const yPos = lastNode ? lastNode.position.y + 140 : 200;

    const newNode: Node = {
      id: crypto.randomUUID(),
      type: 'automation',
      position: { x: 250, y: yPos },
      data: {
        nodeType: type,
        label: addButtons.find((b) => b.type === type)?.label || type,
        config: type === 'delay' ? { delay_seconds: 5 } : {},
        preview: type === 'delay' ? '5s de espera' : '',
      },
    };

    setNodes((nds) => [...nds, newNode]);

    // Auto-connect to last node
    if (lastNode) {
      const newEdge: Edge = {
        id: `e-${lastNode.id}-${newNode.id}`,
        source: lastNode.id,
        target: newNode.id,
        animated: true,
        style: { stroke: 'hsl(var(--primary))' },
      };
      setEdges((eds) => [...eds, newEdge]);
    }
  };

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if ((node.data.nodeType as string) === 'trigger') return;
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

  const saveFlow = async () => {
    if (!id) return;
    setSaving(true);

    // Update flow metadata
    await supabase
      .from('automation_flows')
      .update({ name: flowName, description: flowDescription })
      .eq('id', id);

    // Delete existing nodes and edges, then re-insert
    await supabase.from('automation_edges').delete().eq('flow_id', id);
    await supabase.from('automation_nodes').delete().eq('flow_id', id);

    // Insert nodes
    if (nodes.length > 0) {
      const nodeInserts = nodes.map((n, i) => ({
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

    // Insert edges
    if (edges.length > 0) {
      const edgeInserts = edges.map((e) => ({
        id: e.id,
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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/automation')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="text-sm font-semibold text-card-foreground bg-transparent border-none focus:outline-none focus:ring-0 w-48"
            placeholder="Nome do fluxo"
          />
        </div>
        <button
          onClick={saveFlow}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
      </div>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Toolbar */}
        <div className="w-14 border-r border-border bg-card flex flex-col items-center py-3 gap-2 shrink-0">
          {addButtons.map((btn) => (
            <button
              key={btn.type}
              onClick={() => addNode(btn.type)}
              title={btn.label}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <btn.icon className="h-4 w-4" />
            </button>
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
            nodeTypes={nodeTypes}
            fitView
            className="bg-background"
          >
            <Controls className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
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
