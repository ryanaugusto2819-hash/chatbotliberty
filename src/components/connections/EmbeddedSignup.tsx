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
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading_sdk' | 'ready' | 'signing_up' | 'exchanging' | 'success' | 'error'>('idle');
  const [label, setLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch APP_ID from backend
  useEffect(() => {
    const fetchAppId = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('meta-embedded-signup', {
          body: { action: 'get_app_id' },
        });
        if (error) throw error;
        setAppId(data.app_id);
      } catch {
        setErrorMsg('Erro ao carregar configuração do Facebook.');
        setStatus('error');
      }
    };
    fetchAppId();
  }, []);

  // Load Facebook SDK
  useEffect(() => {
    if (!appId) return;
    setStatus('loading_sdk');

    // If already loaded
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

    // Load SDK script
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [appId]);

  const handleEmbeddedSignup = useCallback(() => {
    if (!window.FB || !sdkReady) {
      toast.error('Facebook SDK ainda não carregou. Aguarde...');
      return;
    }

    setStatus('signing_up');
    setErrorMsg('');

    window.FB.login(
      (response: any) => {
        if (response.authResponse) {
          const { accessToken } = response.authResponse;
          handleTokenExchange(accessToken);
        } else {
          setStatus('ready');
          if (response.status === 'not_authorized') {
            toast.error('Você não autorizou o app. Tente novamente.');
          } else {
            toast.info('Login cancelado.');
          }
        }
      },
      {
        config_id: undefined, // Use default login dialog
        scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
        extras: {
          setup: {
            // Embedded Signup specific
          },
          featureType: '',
          sessionInfoVersion: 2,
        },
      }
    );
  }, [sdkReady, label]);

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

      if (data?.success) {
        setStatus('success');
        if (data.status === 'active') {
          toast.success(`WhatsApp conectado! Número: ${data.phone_display || data.phone_number_id}`);
        } else {
          toast.success('Conta conectada! Complete a configuração do número no Meta Business.');
        }
        setTimeout(() => onSuccess(), 1500);
      } else {
        throw new Error(data?.error || 'Falha desconhecida');
      }
    } catch (err: any) {
      console.error('Token exchange error:', err);
      setErrorMsg(err.message || 'Erro ao processar conexão.');
      setStatus('error');
      toast.error('Erro ao conectar WhatsApp.');
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Label */}
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

      {/* Info */}
      <div className="rounded-xl bg-secondary/50 p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-card-foreground text-sm">Como funciona:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Faça login com sua conta do Facebook</li>
          <li>Selecione ou crie um Business Manager</li>
          <li>Configure sua conta WhatsApp Business</li>
          <li>Vincule seu número de telefone</li>
        </ol>
        <p className="text-[11px] mt-2">
          Seus dados são trocados de forma segura no backend. O App Secret nunca é exposto.
        </p>
      </div>

      {/* Status Messages */}
      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          WhatsApp conectado com sucesso!
        </div>
      )}

      {/* Actions */}
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
          {status === 'exchanging' && 'Configurando...'}
          {status === 'success' && 'Conectado!'}
          {status === 'error' && 'Tentar Novamente'}
        </button>
      </div>
    </div>
  );
}
