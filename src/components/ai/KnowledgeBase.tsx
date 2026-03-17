import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Plus, Trash2, Upload, FileText, MessageSquare, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface KBItem {
  id: string;
  type: string;
  title: string;
  content: string;
  file_url: string | null;
  created_at: string;
}

type TabType = 'text' | 'qa' | 'file';

export default function KnowledgeBase() {
  const [items, setItems] = useState<KBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [uploading, setUploading] = useState(false);

  // Form states
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('knowledge_base_items')
      .select('*')
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  const addTextItem = async () => {
    if (!textTitle.trim() || !textContent.trim()) {
      toast.error('Preencha título e conteúdo');
      return;
    }
    const { error } = await supabase.from('knowledge_base_items').insert({
      type: 'text',
      title: textTitle.trim(),
      content: textContent.trim(),
    });
    if (error) {
      toast.error('Erro ao adicionar');
    } else {
      toast.success('Conhecimento adicionado');
      setTextTitle('');
      setTextContent('');
      fetchItems();
    }
  };

  const addQAItem = async () => {
    if (!qaQuestion.trim() || !qaAnswer.trim()) {
      toast.error('Preencha pergunta e resposta');
      return;
    }
    const { error } = await supabase.from('knowledge_base_items').insert({
      type: 'qa',
      title: qaQuestion.trim(),
      content: qaAnswer.trim(),
    });
    if (error) {
      toast.error('Erro ao adicionar');
    } else {
      toast.success('Pergunta e resposta adicionadas');
      setQaQuestion('');
      setQaAnswer('');
      fetchItems();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande (máx 10MB)');
      return;
    }

    setUploading(true);
    const fileName = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('knowledge-base')
      .upload(fileName, file);

    if (uploadError) {
      toast.error('Erro ao enviar arquivo');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('knowledge-base')
      .getPublicUrl(fileName);

    // Read text content from file if it's a text-based file
    let content = '';
    const textTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
    if (textTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      content = await file.text();
    } else {
      content = `[Arquivo: ${file.name}]`;
    }

    const { error } = await supabase.from('knowledge_base_items').insert({
      type: 'file',
      title: file.name,
      content: content.substring(0, 50000), // Limit content size
      file_url: urlData.publicUrl,
    });

    if (error) {
      toast.error('Erro ao salvar referência do arquivo');
    } else {
      toast.success('Arquivo enviado com sucesso');
      fetchItems();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteItem = async (item: KBItem) => {
    // Delete file from storage if applicable
    if (item.file_url) {
      const fileName = item.file_url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('knowledge-base').remove([fileName]);
      }
    }

    const { error } = await supabase
      .from('knowledge_base_items')
      .delete()
      .eq('id', item.id);

    if (error) {
      toast.error('Erro ao excluir');
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success('Item excluído');
    }
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'text', label: 'Texto Livre', icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'qa', label: 'Perguntas e Respostas', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { key: 'file', label: 'Arquivos', icon: <Upload className="h-3.5 w-3.5" /> },
  ];

  const typeIcon = (type: string) => {
    if (type === 'qa') return <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />;
    if (type === 'file') return <Upload className="h-3.5 w-3.5 text-primary shrink-0" />;
    return <FileText className="h-3.5 w-3.5 text-primary shrink-0" />;
  };

  const typeLabel = (type: string) => {
    if (type === 'qa') return 'P&R';
    if (type === 'file') return 'Arquivo';
    return 'Texto';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="rounded-xl border border-border bg-card p-6 shadow-elevated"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
          <BookOpen className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-card-foreground">Base de Conhecimento</p>
          <p className="text-xs text-muted-foreground">
            Informações que a IA usa para responder com mais precisão
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 flex-1 justify-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add Forms */}
      {activeTab === 'text' && (
        <div className="space-y-3 mb-6">
          <input
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder="Título (ex: Informações sobre a empresa)"
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={5}
            placeholder="Cole aqui informações sobre produtos, serviços, FAQs, políticas, etc."
            className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={addTextItem}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar Conhecimento
          </button>
        </div>
      )}

      {activeTab === 'qa' && (
        <div className="space-y-3 mb-6">
          <input
            value={qaQuestion}
            onChange={(e) => setQaQuestion(e.target.value)}
            placeholder="Pergunta (ex: Qual o horário de funcionamento?)"
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={qaAnswer}
            onChange={(e) => setQaAnswer(e.target.value)}
            rows={3}
            placeholder="Resposta (ex: Funcionamos de segunda a sexta, das 9h às 18h)"
            className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={addQAItem}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar Pergunta e Resposta
          </button>
        </div>
      )}

      {activeTab === 'file' && (
        <div className="space-y-3 mb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background p-8 cursor-pointer hover:border-primary/50 transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            )}
            <p className="text-sm font-medium text-foreground">
              {uploading ? 'Enviando...' : 'Clique para enviar um arquivo'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, TXT, MD, CSV, JSON — máx 10MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.json,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Items List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Nenhum conhecimento adicionado. Adicione textos, perguntas ou arquivos para treinar a IA.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-background p-3 group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {typeIcon(item.type)}
                  <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {typeLabel(item.type)}
                  </span>
                </div>
                <button
                  onClick={() => deleteItem(item)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 ml-5.5">
                {item.type === 'qa' ? `R: ${item.content}` : item.content.substring(0, 150)}
                {item.content.length > 150 && '...'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 mt-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Dica:</strong> Adicione informações completas sobre seus produtos,
          serviços, preços e políticas. Quanto mais contexto a IA tiver, melhor serão as respostas.
        </p>
      </div>
    </motion.div>
  );
}
