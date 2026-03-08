import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { MessageSquare, Plug, CheckCircle2, XCircle, ExternalLink, Copy, Eye, EyeOff, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectionField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'password';
  helpText?: string;
}

interface ConnectionConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  fields: ConnectionField[];
  docsUrl?: string;
  webhookUrl?: string;
}

const WEBHOOK_URL = `https://glceihfavfvebaaxgsnq.supabase.co/functions/v1/whatsapp-webhook`;

const connections: ConnectionConfig[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Cloud API',
    description: 'Conecte sua conta do WhatsApp Business para receber e enviar mensagens.',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'bg-accent text-accent-foreground',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    webhookUrl: WEBHOOK_URL,
    fields: [
      {
        key: 'whatsapp_phone_number_id',
        label: 'Phone Number ID',
        placeholder: 'Ex: 123456789012345',
        type: 'text',
        helpText: 'Encontrado em Meta for Developers → WhatsApp → API Setup.',
      },
      {
        key: 'whatsapp_access_token',
        label: 'Access Token (Permanente)',
        placeholder: 'EAAxxxxxxx...',
        type: 'password',
        helpText: 'Token permanente gerado via System User no Meta Business Suite.',
      },
      {
        key: 'whatsapp_verify_token',
        label: 'Verify Token (Webhook)',
        placeholder: 'meu_token_secreto',
        type: 'text',
        helpText: 'Token customizado que você definirá também no painel da Meta para validar o webhook.',
      },
    ],
  },
];

function ConnectionCard({ config }: { config: ConnectionConfig }) {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleSave = async () => {
    const missing = config.fields.filter(f => !values[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Preencha todos os campos: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setSaving(true);
    // Simulate saving — in production this would call an edge function to update secrets
    await new Promise(resolve => setTimeout(resolve, 1200));
    setSaving(false);
    setConnected(true);
    toast.success(`${config.name} configurado com sucesso!`);
  };

  const copyWebhook = () => {
    if (config.webhookUrl) {
      navigator.clipboard.writeText(config.webhookUrl);
      toast.success('URL do webhook copiada!');
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.color}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-card-foreground">{config.name}</h3>
            {connected ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-accent-foreground bg-accent px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                <XCircle className="h-3 w-3" /> Desconectado
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
        </div>
        <Plug className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-45' : ''}`} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-5">
          {/* Webhook URL */}
          {config.webhookUrl && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                URL do Webhook (cole na Meta)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-input bg-secondary/50 px-3 py-2 text-xs text-foreground font-mono truncate">
                  {config.webhookUrl}
                </div>
                <button
                  onClick={copyWebhook}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  title="Copiar URL"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Fields */}
          {config.fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium text-card-foreground">{field.label}</label>
              <div className="relative">
                <input
                  type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                  value={values[field.key] || ''}
                  onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-input bg-background py-2.5 px-4 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => toggleSecret(field.key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {field.helpText && (
                <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {config.docsUrl && (
              <a
                href={config.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver documentação
              </a>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 ml-auto"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Connections() {
  return (
    <div>
      <TopBar title="Conexões" subtitle="Configure suas integrações e canais de atendimento" />
      <div className="p-6 max-w-3xl">
        <div className="space-y-4">
          {connections.map(config => (
            <ConnectionCard key={config.id} config={config} />
          ))}
        </div>

        {/* Future connections hint */}
        <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
          <Plug className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Mais integrações em breve — Instagram, Telegram, Email e mais.
          </p>
        </div>
      </div>
    </div>
  );
}
