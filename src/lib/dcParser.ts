import type { Node, Edge } from '@xyflow/react';

interface DcStep {
  name: string;
  group: string;
  stepId: string;
  options: Record<string, unknown>;
}

interface DcBlock {
  id: string;
  type: string;
  options: Record<string, unknown>;
  presentation?: { x: number; y: number };
}

interface DcFile {
  id: string;
  name: string;
  blocks: DcBlock[];
}

function mapTrigger(block: DcBlock): { nodeType: string; label: string; config: Record<string, unknown> } {
  const triggers = (block.options.triggers as Array<{ name: string; options: Record<string, unknown> }>) || [];
  const activeTriggers: string[] = [];
  let keywords: string[] = [];

  for (const t of triggers) {
    if (t.name === 'manually-lead-trigger') activeTriggers.push('manual');
    if (t.name === 'message-received-trigger') {
      activeTriggers.push('keyword');
      keywords = (t.options.keywords as string[]) || [];
    }
  }

  return {
    nodeType: 'trigger',
    label: activeTriggers.length === 1
      ? activeTriggers[0] === 'manual' ? 'Disparo Manual' : 'Palavra-chave'
      : 'Gatilho Múltiplo',
    config: {
      trigger_type: activeTriggers[0] || 'manual',
      active_triggers: activeTriggers,
      keywords,
      connection_ids: [],
    },
  };
}

function mapChatSteps(steps: DcStep[]): Array<{ nodeType: string; label: string; config: Record<string, unknown> }> {
  const result: Array<{ nodeType: string; label: string; config: Record<string, unknown> }> = [];

  for (const step of steps) {
    if (step.name === 'delay-message') {
      result.push({
        nodeType: 'delay',
        label: `Esperar ${step.options.seconds}s`,
        config: {
          delay_value: step.options.seconds as number,
          delay_unit: 'seconds',
          delay_seconds: step.options.seconds as number,
        },
      });
    } else if (step.name === 'send-text-message') {
      const text = step.options.text as string || '';
      const buttons = step.options.buttons as Array<{ text: string }> | undefined;
      
      if (buttons && buttons.length > 0) {
        result.push({
          nodeType: 'quick_reply',
          label: 'Resposta Rápida',
          config: {
            content: text,
            buttons: buttons.map(b => b.text.trim()),
          },
        });
      } else {
        result.push({
          nodeType: 'message',
          label: 'Mensagem',
          config: { content: text },
        });
      }
    } else if (step.name === 'send-file-message') {
      const opts = step.options;
      const mimeType = (opts.mimeType as string) || '';
      const platforms = (opts.platforms as Array<{ url: string; mimeType: string; filename: string }>) || [];
      
      // Get URL: prefer direct url, fallback to platform-specific
      let url = (opts.url as string) || '';
      let actualMime = mimeType;
      let filename = (opts.filename as string) || '';
      
      if ((!url || url === '') && platforms.length > 0) {
        url = platforms[0].url;
        actualMime = platforms[0].mimeType || mimeType;
        filename = platforms[0].filename || filename;
      }

      if (actualMime.startsWith('image/')) {
        result.push({
          nodeType: 'image',
          label: 'Imagem',
          config: { media_url: url, caption: (opts.text as string) || '' },
        });
      } else if (actualMime.startsWith('audio/')) {
        result.push({
          nodeType: 'audio',
          label: 'Áudio',
          config: { media_url: url },
        });
      } else if (actualMime.startsWith('video/')) {
        result.push({
          nodeType: 'video',
          label: 'Vídeo',
          config: { media_url: url, caption: (opts.text as string) || '' },
        });
      } else {
        result.push({
          nodeType: 'document',
          label: filename || 'Documento',
          config: { media_url: url, caption: (opts.text as string) || '', filename },
        });
      }
    }
  }

  return result;
}

function mapActions(block: DcBlock): Array<{ nodeType: string; label: string; config: Record<string, unknown> }> {
  const actions = (block.options.actions as Array<{ name: string; options: Record<string, unknown> }>) || [];
  const result: Array<{ nodeType: string; label: string; config: Record<string, unknown> }> = [];

  for (const action of actions) {
    if (action.name === 'add-tag-action') {
      result.push({
        nodeType: 'action',
        label: 'Adicionar Etiqueta',
        config: { action_type: 'add_tag', tag_name: (action.options.tagName as string) || 'etiqueta' },
      });
    } else if (action.name === 'remove-tag-action') {
      result.push({
        nodeType: 'action',
        label: 'Remover Etiqueta',
        config: { action_type: 'remove_tag', tag_name: (action.options.tagName as string) || 'etiqueta' },
      });
    }
  }

  return result;
}

export function parseDcFile(
  content: string,
  onDelete: (nodeId: string) => void,
  getPreview: (type: string, config: Record<string, unknown>) => string
): { nodes: Node[]; edges: Edge[] } {
  const dc: DcFile = JSON.parse(content);
  const allMapped: Array<{ nodeType: string; label: string; config: Record<string, unknown> }> = [];

  // Order blocks: trigger first, then chat, then action
  const triggerBlock = dc.blocks.find(b => b.type === 'trigger');
  const chatBlocks = dc.blocks.filter(b => b.type === 'chat');
  const actionBlocks = dc.blocks.filter(b => b.type === 'action');

  if (triggerBlock) {
    allMapped.push(mapTrigger(triggerBlock));
  }

  for (const chat of chatBlocks) {
    const messages = (chat.options.messages as DcStep[]) || [];
    allMapped.push(...mapChatSteps(messages));
  }

  for (const action of actionBlocks) {
    allMapped.push(...mapActions(action));
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  allMapped.forEach((item, i) => {
    const nodeId = crypto.randomUUID();
    const y = i * 160 + 50;
    
    nodes.push({
      id: nodeId,
      type: 'automation',
      position: { x: 300, y },
      data: {
        nodeType: item.nodeType,
        label: item.label,
        config: item.config,
        preview: getPreview(item.nodeType, item.config),
        onDelete,
      },
      deletable: true,
    });

    if (i > 0) {
      edges.push({
        id: `e-${nodes[i - 1].id}-${nodeId}`,
        source: nodes[i - 1].id,
        target: nodeId,
        animated: true,
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      });
    }
  });

  return { nodes, edges };
}
