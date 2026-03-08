import { useState } from 'react';
import { X, MessageSquare, Clock, Image, Music, Video, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NodeConfig {
  content?: string;
  delay_seconds?: number;
  media_url?: string;
  caption?: string;
}

interface NodeEditorProps {
  nodeId: string;
  nodeType: string;
  label: string;
  config: NodeConfig;
  onSave: (nodeId: string, label: string, config: NodeConfig) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export default function NodeEditor({ nodeId, nodeType, label, config, onSave, onDelete, onClose }: NodeEditorProps) {
  const [editLabel, setEditLabel] = useState(label);
  const [editConfig, setEditConfig] = useState<NodeConfig>(config);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${nodeId}.${ext}`;

    const { error } = await supabase.storage
      .from('automation-media')
      .upload(path, file, { upsert: true });

    if (error) {
      toast.error('Erro ao fazer upload');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('automation-media')
      .getPublicUrl(path);

    setEditConfig((prev) => ({ ...prev, media_url: urlData.publicUrl }));
    setUploading(false);
    toast.success('Upload concluído');
  };

  const handleSave = () => {
    onSave(nodeId, editLabel, editConfig);
    onClose();
  };

  const iconMap: Record<string, React.ElementType> = {
    message: MessageSquare,
    delay: Clock,
    image: Image,
    audio: Music,
    video: Video,
  };
  const Icon = iconMap[nodeType] || MessageSquare;

  return (
    <div className="absolute right-0 top-0 h-full w-80 border-l border-border bg-card z-50 flex flex-col shadow-lg">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-card-foreground">Editar Nó</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nome</label>
          <input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Content for message */}
        {nodeType === 'message' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
            <textarea
              value={editConfig.content || ''}
              onChange={(e) => setEditConfig((p) => ({ ...p, content: e.target.value }))}
              rows={4}
              placeholder="Digite a mensagem..."
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Delay */}
        {nodeType === 'delay' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tempo de espera (segundos)</label>
            <input
              type="number"
              min={1}
              value={editConfig.delay_seconds || 5}
              onChange={(e) => setEditConfig((p) => ({ ...p, delay_seconds: parseInt(e.target.value) || 5 }))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Media types (image, audio, video) */}
        {['image', 'audio', 'video'].includes(nodeType) && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Arquivo</label>
              {editConfig.media_url ? (
                <div className="space-y-2">
                  {nodeType === 'image' && (
                    <img src={editConfig.media_url} alt="" className="w-full rounded-lg border border-border" />
                  )}
                  {nodeType === 'audio' && (
                    <audio src={editConfig.media_url} controls className="w-full" />
                  )}
                  {nodeType === 'video' && (
                    <video src={editConfig.media_url} controls className="w-full rounded-lg" />
                  )}
                  <p className="text-[11px] text-muted-foreground truncate">{editConfig.media_url}</p>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-input p-6 text-center">
                  <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum arquivo selecionado</p>
                </div>
              )}
              <label className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {uploading ? 'Enviando...' : 'Fazer Upload'}
                <input type="file" accept={nodeType === 'image' ? 'image/*' : nodeType === 'audio' ? 'audio/*' : 'video/*'} onChange={handleUpload} className="hidden" />
              </label>
            </div>

            {nodeType !== 'audio' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Legenda (opcional)</label>
                <input
                  value={editConfig.caption || ''}
                  onChange={(e) => setEditConfig((p) => ({ ...p, caption: e.target.value }))}
                  placeholder="Legenda da mídia..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={handleSave}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Salvar
        </button>
        <button
          onClick={() => { onDelete(nodeId); onClose(); }}
          className="w-full rounded-lg bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
        >
          Excluir Nó
        </button>
      </div>
    </div>
  );
}
