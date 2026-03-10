import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { MessageSquare, Plug, CheckCircle2, XCircle, ExternalLink, Copy, Eye, EyeOff, Save, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
const ZAPI_WEBHOOK_URL = `https://glceihfavfvebaaxgsnq.supabase.co/functions/v1/zapi-webhook`;

const connections: ConnectionConfig[] = [
  {
    id: 'zapi',
    name: 'Z-API (WhatsApp via QR Code)',
    description: 'Conecte seu WhatsApp pessoal ou Business via QR Code usando a Z-API. Sem necessidade de conta Meta Business.',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'bg-accent text-accent-foreground',
    docsUrl: 'https://developer.z-api.io',
    webhookUrl: ZAPI_WEBHOOK_URL,
    fields: [
      {
        key: 'zapi_instance_id',
        label: 'Instance ID',
        placeholder: 'Ex: 3C2A7F8B9D1E...',
        type: 'text',
        helpText: 'Encontrado no painel da Z-API ao criar uma instância.',
      },
      {
        key: 'zapi_token',
        label: 'Token',
        placeholder: 'Ex: A1B2C3D4E5F6...',
        type: 'password',
        helpText: 'Token da instância, visível no painel da Z-API.',
      },
      {
        key: 'zapi_client_token',
        label: 'Client-Token',
        placeholder: 'Ex: F1a2b3c4d5e6...',
        type: 'password',
        helpText: 'Token da conta Z-API. Encontrado em Configurações da conta no painel da Z-API.',
      },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Cloud API (Meta)',
    description: 'Conecte via API oficial da Meta. Requer conta Meta Business verificada.',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'bg-secondary text-secondary-foreground',
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
  const [deleting, setDeleting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load connection status from database
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const { data } = await supabase
          .from('connection_configs')
          .select('is_connected, config')
          .eq('connection_id', config.id)
          .maybeSingle();

        if (data) {
          setConnected(data.is_connected);
          const savedConfig = data.config as Record<string, string> | null;
          if (savedConfig) {
            const prefill: Record<string, string> = {};
            // Prefill non-sensitive fields based on connection type
            if (config.id === 'whatsapp') {
              if (savedConfig.phone_number_id) prefill.whatsapp_phone_number_id = savedConfig.phone_number_id;
              if (savedConfig.verify_token) prefill.whatsapp_verify_token = savedConfig.verify_token;
            } else if (config.id === 'zapi') {
              if (savedConfig.instance_id) prefill.zapi_instance_id = savedConfig.instance_id;
            }
            setValues(prefill);
          }
        }
      } catch {
        // No config yet
      } finally {
        setLoading(false);
      }
    };
    loadStatus();
  }, [config.id]);

  const handleSave = async () => {
    const missing = config.fields.filter(f => !values[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Preencha todos os campos: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-connection', {
        body: {
          connectionId: config.id,
          config: values,
        },
      });

      if (error) throw error;

      setConnected(true);
      toast.success(`${config.name} configurado com sucesso!`);
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('Erro ao salvar configuração. Verifique suas permissões.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('save-connection', {
        body: {
          connectionId: config.id,
          action: 'delete',
        },
      });
      if (error) throw error;
      setConnected(false);
      setValues({});
      toast.success(`${config.name} desconectado com sucesso!`);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('Erro ao excluir conexão.');
    } finally {
      setDeleting(false);
    }
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
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : connected ? (
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

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-5">
          {config.webhookUrl && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                URL do Webhook (cole no painel do provedor)
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
            <div className="flex items-center gap-2 ml-auto">
              {connected && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={deleting}
                      className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Excluir
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir conexão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir a conexão <strong>{config.name}</strong>? Todas as credenciais salvas serão removidas e a integração parará de funcionar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>
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
