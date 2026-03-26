import { supabase } from "@/integrations/supabase/client";

// Cache profile id per session to avoid repeated queries
let cachedProfileId: string | null | undefined = undefined;

export async function sendWhatsAppMessage(
  conversationId: string,
  message: string
) {
  // Run profile lookup and connection check in parallel
  const [profileResult, connectionsResult] = await Promise.all([
    // Only fetch profile once per session
    cachedProfileId !== undefined
      ? Promise.resolve(cachedProfileId)
      : (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', session.user.id)
              .maybeSingle();
            cachedProfileId = profile?.id ?? null;
          } else {
            cachedProfileId = null;
          }
          return cachedProfileId;
        })(),
    supabase
      .from("connection_configs")
      .select("connection_id, is_connected")
      .in("connection_id", ["zapi", "whatsapp"])
      .eq("is_connected", true),
  ]);

  const senderAgentId = profileResult;
  const zapiConnected = connectionsResult.data?.some((c) => c.connection_id === "zapi");

  // Prefer Z-API if connected, fallback to WhatsApp Cloud API
  const functionName = zapiConnected ? "zapi-send" : "whatsapp-send";

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { conversationId, message, senderAgentId, senderLabel: 'humano' },
  });

  // supabase.functions.invoke returns error for non-2xx, but the edge function
  // may have already saved the message (even as failed). Check data first.
  if (error) {
    // Try to parse the error body — the edge function returns savedMessage even on 502
    let parsed: any = null;
    try {
      if (error instanceof Object && 'context' in error) {
        const ctx = (error as any).context;
        if (ctx?.body) {
          const reader = ctx.body.getReader?.();
          if (reader) {
            const { value } = await reader.read();
            parsed = JSON.parse(new TextDecoder().decode(value));
          }
        }
      }
    } catch { /* ignore parse errors */ }

    // If the edge function saved the message (even as failed), return it
    if (parsed?.savedMessage) {
      return parsed;
    }
    throw error;
  }

  return data;
}
