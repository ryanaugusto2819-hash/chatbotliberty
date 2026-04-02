import { useState } from 'react';
import { FileText, Loader2, X, Download, Send, Sparkles, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DocumentGeneratorProps {
  contactName: string;
  contactPhone: string;
  conversationId: string;
  onSendDocument?: (pdfUrl: string) => void;
}

export default function DocumentGenerator({ contactName, contactPhone, conversationId, onSendDocument }: DocumentGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: contactName || '',
    cpf: '',
    tratamento_meses: '',
    valor: '',
    forma_pagamento: 'boleto à vista',
    data_compra: new Date().toLocaleDateString('pt-BR'),
    empresa: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleGenerate = async () => {
    if (!form.nome || !form.cpf || !form.tratamento_meses || !form.valor || !form.data_compra) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setGenerating(true);
    setGeneratedPdfUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-document', {
        body: { ...form, conversation_id: conversationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.pdf_url) {
        setGeneratedPdfUrl(data.pdf_url);
        toast.success('PDF gerado com sucesso!');
      }
    } catch (err: any) {
      console.error('Document generation error:', err);
      toast.error(`Erro: ${err.message || 'Falha ao gerar documento'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendViaWhatsApp = () => {
    if (generatedPdfUrl && onSendDocument) {
      onSendDocument(generatedPdfUrl);
      toast.success('PDF enviado para o chat!');
      setOpen(false);
      setGeneratedPdfUrl(null);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-2 px-3 text-xs font-medium transition-all shadow-sm hover:shadow-md"
      >
        <FileText className="h-3.5 w-3.5" />
        Gerar Documento PDF
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800/50 bg-gradient-to-b from-purple-50/80 to-white dark:from-purple-950/30 dark:to-card p-3.5 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
            <FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Gerar Documento</p>
            <p className="text-[10px] text-muted-foreground">Termo de Compromisso em PDF</p>
          </div>
        </div>
        <button onClick={() => { setOpen(false); setGeneratedPdfUrl(null); }} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-secondary text-muted-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Form */}
      {!generatedPdfUrl ? (
        <div className="space-y-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Nome Completo *</label>
            <input
              value={form.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              className="w-full mt-0.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              placeholder="Maria José dos Santos"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">CPF *</label>
            <input
              value={form.cpf}
              onChange={(e) => handleChange('cpf', formatCpf(e.target.value))}
              className="w-full mt-0.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Tratamento (meses) *</label>
              <input
                type="number"
                value={form.tratamento_meses}
                onChange={(e) => handleChange('tratamento_meses', e.target.value)}
                className="w-full mt-0.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                placeholder="5"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Valor (R$) *</label>
              <input
                type="text"
                value={form.valor}
                onChange={(e) => handleChange('valor', e.target.value)}
                className="w-full mt-0.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                placeholder="397,00"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Forma de Pagamento *</label>
            <select
              value={form.forma_pagamento}
              onChange={(e) => handleChange('forma_pagamento', e.target.value)}
              className="w-full mt-0.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
            >
              <option value="boleto à vista">Boleto à Vista</option>
              <option value="pix">PIX</option>
              <option value="cartão de crédito">Cartão de Crédito</option>
              <option value="cartão de crédito parcelado">Cartão Parcelado</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Data da Compra *</label>
              <input
                value={form.data_compra}
                onChange={(e) => handleChange('data_compra', e.target.value)}
                className="w-full mt-0.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                placeholder="20/01/2025"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Empresa</label>
              <input
                value={form.empresa}
                onChange={(e) => handleChange('empresa', e.target.value)}
                className="w-full mt-0.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                placeholder="Nome da empresa"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-2 text-xs font-medium transition-all disabled:opacity-50 shadow-sm mt-1"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Gerar PDF
              </>
            )}
          </button>
        </div>
      ) : (
        /* Preview & Actions */
        <div className="space-y-2.5">
          <div className="rounded-lg border border-border overflow-hidden bg-muted/30 p-4 flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
              <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">PDF Gerado!</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Termo de Compromisso — {form.nome}</p>
            </div>
            <a
              href={generatedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Visualizar PDF
            </a>
          </div>
          <div className="flex gap-2">
            <a
              href={generatedPdfUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar PDF
            </a>
            <button
              onClick={handleSendViaWhatsApp}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white py-1.5 text-xs font-medium transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar via WhatsApp
            </button>
          </div>
          <button
            onClick={() => setGeneratedPdfUrl(null)}
            className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar e editar dados
          </button>
        </div>
      )}
    </div>
  );
}
