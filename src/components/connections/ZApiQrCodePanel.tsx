import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Wifi, WifiOff, RefreshCw, QrCode, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ZApiQrCodePanelProps {
  configId: string;
  onConnected: () => void;
}

type ConnectionStatus = 'checking' | 'waiting_qr' | 'connected' | 'disconnected' | 'error';

export default function ZApiQrCodePanel({ configId, onConnected }: ZApiQrCodePanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('zapi-qrcode', {
        body: { configId, action: 'status' },
      });
      if (error) throw error;
      if (!mountedRef.current) return;

      const connStatus = (data as any)?.connectionStatus;
      if (connStatus === 'connected') {
        setStatus('connected');
        setQrCode(null);
        setErrorMsg(null);
        stopPolling();
        toast.success('WhatsApp conectado com sucesso!');
        onConnected();
        return 'connected';
      }
      return 'disconnected';
    } catch (err: any) {
      if (!mountedRef.current) return 'error';
      setErrorMsg(err?.message || 'Erro ao verificar status');
      return 'error';
    }
  }, [configId, onConnected, stopPolling]);

  const fetchQrCode = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-qrcode', {
        body: { configId, action: 'qrcode' },
      });
      if (error) throw error;
      if (!mountedRef.current) return;

      const resp = data as any;
      if (resp?.connectionStatus === 'connected') {
        setStatus('connected');
        setQrCode(null);
        stopPolling();
        toast.success('WhatsApp conectado com sucesso!');
        onConnected();
        return;
      }

      if (resp?.qrCode) {
        setQrCode(resp.qrCode);
        setStatus('waiting_qr');
      } else {
        setStatus('waiting_qr');
        setQrCode(null);
        setErrorMsg('QR Code ainda não disponível. Aguarde...');
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setStatus('error');
      setErrorMsg(err?.message || 'Erro ao buscar QR Code');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [configId, onConnected, stopPolling]);

  // Start polling on mount
  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      const result = await checkStatus();
      if (result !== 'connected') {
        await fetchQrCode();
        // Poll every 5 seconds: alternate between status check and QR refresh
        let tick = 0;
        intervalRef.current = setInterval(async () => {
          if (!mountedRef.current) return;
          tick++;
          const statusResult = await checkStatus();
          if (statusResult === 'connected') return;
          // Refresh QR every 20 seconds (every 4th tick)
          if (tick % 4 === 0) {
            await fetchQrCode();
          }
        }, 5000);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [checkStatus, fetchQrCode, stopPolling]);

  const handleRefresh = async () => {
    setStatus('checking');
    setQrCode(null);
    try {
      await supabase.functions.invoke('zapi-qrcode', {
        body: { configId, action: 'restart' },
      });
    } catch { /* ignore */ }
    // Wait a moment for Z-API to generate new QR
    setTimeout(async () => {
      const result = await checkStatus();
      if (result !== 'connected') {
        await fetchQrCode();
      }
    }, 3000);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Status indicator */}
      <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${
        status === 'connected'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : status === 'waiting_qr'
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : status === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-muted text-muted-foreground'
      }`}>
        {status === 'connected' && <><Wifi className="h-3.5 w-3.5" /> Conectado</>}
        {status === 'waiting_qr' && <><QrCode className="h-3.5 w-3.5" /> Aguardando leitura do QR Code</>}
        {status === 'checking' && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando...</>}
        {status === 'disconnected' && <><WifiOff className="h-3.5 w-3.5" /> Desconectado</>}
        {status === 'error' && <><WifiOff className="h-3.5 w-3.5" /> Erro</>}
      </div>

      {/* QR Code display */}
      {status === 'waiting_qr' && (
        <div className="flex flex-col items-center gap-3">
          {qrCode ? (
            <div className="rounded-2xl border-2 border-border bg-white p-3 shadow-lg">
              <img
                src={qrCode}
                alt="QR Code WhatsApp"
                className="h-56 w-56 object-contain"
              />
            </div>
          ) : loading ? (
            <div className="flex h-56 w-56 items-center justify-center rounded-2xl border-2 border-dashed border-border">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground max-w-[280px] text-center">
            <Smartphone className="h-4 w-4 shrink-0" />
            <span>Abra o WhatsApp no celular → Dispositivos Conectados → Conectar Dispositivo → Escaneie o QR Code</span>
          </div>
        </div>
      )}

      {/* Connected state */}
      {status === 'connected' && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <Wifi className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-card-foreground">WhatsApp conectado!</p>
          <p className="text-xs text-muted-foreground">Sessão ativa. Mensagens serão recebidas automaticamente.</p>
        </div>
      )}

      {/* Error message */}
      {errorMsg && status !== 'connected' && (
        <p className="text-xs text-destructive text-center max-w-[300px]">{errorMsg}</p>
      )}

      {/* Refresh button */}
      {status !== 'connected' && status !== 'checking' && (
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Gerar novo QR Code
        </button>
      )}
    </div>
  );
}
