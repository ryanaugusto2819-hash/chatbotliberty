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
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', user.id)
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

  if (error) throw error;
  return data;
}
