import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare, Clock, Image, Music, Video, Play } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  message: MessageSquare,
  delay: Clock,
  image: Image,
  audio: Music,
  video: Video,
  trigger: Play,
};

const labelMap: Record<string, string> = {
  message: 'Mensagem',
  delay: 'Delay',
  image: 'Imagem',
  audio: 'Áudio',
  video: 'Vídeo',
  trigger: 'Início',
};

const colorMap: Record<string, string> = {
  trigger: 'bg-primary/15 border-primary/40 text-primary',
  message: 'bg-accent border-accent-foreground/20 text-accent-foreground',
  delay: 'bg-warning/15 border-warning/40 text-warning',
  image: 'bg-info/15 border-info/40 text-info',
  audio: 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/40 dark:text-purple-300',
  video: 'bg-pink-100 border-pink-300 text-pink-700 dark:bg-pink-900/30 dark:border-pink-500/40 dark:text-pink-300',
};

function AutomationNode({ data, selected }: NodeProps) {
  const nodeType = (data.nodeType as string) || 'message';
  const Icon = iconMap[nodeType] || MessageSquare;
  const label = (data.label as string) || labelMap[nodeType] || 'Nó';
  const preview = data.preview as string;
  const colors = colorMap[nodeType] || colorMap.message;

  return (
    <div
      className={`rounded-xl border-2 px-4 py-3 min-w-[200px] max-w-[260px] shadow-md transition-shadow ${colors} ${
        selected ? 'ring-2 ring-ring shadow-lg' : ''
      }`}
    >
      {nodeType !== 'trigger' && (
        <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-3 !h-3 !border-2 !border-background" />
      )}

      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">{labelMap[nodeType]}</span>
      </div>

      <p className="text-sm font-medium truncate">{label}</p>

      {preview && (
        <p className="text-[11px] mt-1 opacity-70 truncate">{preview}</p>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-3 !h-3 !border-2 !border-background" />
    </div>
  );
}

export default memo(AutomationNode);
