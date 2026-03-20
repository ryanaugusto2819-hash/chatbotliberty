import { useState, useEffect, useCallback } from 'react';
import { Loader2, Facebook, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

interface EmbeddedSignupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EmbeddedSignup({ onSuccess, onCancel }: EmbeddedSignupProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading_sdk' | 'ready' | 'signing_up' | 'exchanging' | 'success' | 'error'>('idle');
  const [label, setLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchAppId = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('meta-embedded-signup', {
          body: { action: 'get_app_id' },
        });
        if (error) throw error;
        setAppId(data.app_id);
        setWebhookUrl(data.webhook_url || '');
      } catch {
        setErrorMsg('Erro ao carregar configuração do Facebook.');
        setStatus('error');
      }
    };
    fetchAppId();
  }, []);

  useEffect(() => {
    if (!appId) return;
    setStatus('loading_sdk');

    if (window.FB) {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      });
      setSdkReady(true);
      setStatus('ready');
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      });
      setSdkReady(true);
      setStatus('ready');
    };

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [appId]);

  const handleTokenExchange = async (shortLivedToken: string) => {
    setStatus('exchanging');
    try {
      const { data, error } = await supabase.functions.invoke('meta-embedded-signup', {
        body: {
          action: 'exchange_token',
          accessToken: shortLivedToken,
          label: label.trim() || undefined,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha desconhecida');

      setStatus('success');
      toast.success(`Conexão criada para ${data.phone_display || data.phone_number_id}`);
      setTimeout(() => onSuccess(), 1200);
    } catch (err: any) {
      console.error('Token exchange error:', err);
      setErrorMsg(err.message || 'Erro ao processar conexão.');
      setStatus('error');
      toast.error('Erro ao conectar WhatsApp.');
    }
  };

  const handleEmbeddedSignup = useCallback(() => {
    if (!window.FB || !sdkReady) {
      toast.error('Facebook SDK ainda não carregou. Aguarde...');
      return;
    }

    setStatus('signing_up');
    setErrorMsg('');

    window.FB.login(
      (response: any) => {
        if (response.authResponse?.accessToken) {
          handleTokenExchange(response.authResponse.accessToken);
          return;
        }

        setStatus('ready');
        if (response.status === 'not_authorized') {
          toast.error('Você não autorizou o app.');
        } else {
          toast.info('Login cancelado.');
        }
      },
      {
        scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management,whatsapp_business_manage_events',
        extras: {
          sessionInfoVersion: 2,
        },
      }
    );
  }, [sdkReady, label]);

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Nome da conexão (opcional)</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Ex: Número Principal, Vendas..."
          className="w-full rounded-xl border border-input bg-background py-2.5 px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="rounded-xl bg-secondary/50 p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-card-foreground text-sm">Refazer do zero:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Entre com a conta Meta correta</li>
          <li>Compartilhe o ativo do WhatsApp Business com este app</li>
          <li>Selecione o número correto</li>
          <li>Depois valide a conexão no card</li>
        </ol>
        {webhookUrl && (
          <p className="text-[11px] mt-2 break-all">
            Webhook esperado: <span className="font-mono text-foreground">{webhookUrl}</span>
          </p>
        )}
      </div>

      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Conexão criada com sucesso!
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-input px-4 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={handleEmbeddedSignup}
          disabled={!sdkReady || status === 'signing_up' || status === 'exchanging' || status === 'success'}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#166FE5] transition-colors disabled:opacity-50 active:scale-[0.97]"
        >
          {(status === 'signing_up' || status === 'exchanging' || status === 'loading_sdk') ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Facebook className="h-4 w-4" />
          )}
          {status === 'loading_sdk' && 'Carregando...'}
          {status === 'ready' && 'Conectar com Facebook'}
          {status === 'idle' && 'Conectar com Facebook'}
          {status === 'signing_up' && 'Autorizando...'}
          {status === 'exchanging' && 'Validando app e webhook...'}
          {status === 'success' && 'Conectado!'}
          {status === 'error' && 'Tentar Novamente'}
        </button>
      </div>
    </div>
  );
}
