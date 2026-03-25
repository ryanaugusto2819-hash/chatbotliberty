import { supabase } from "@/integrations/supabase/client";

export async function sendWhatsAppMessage(
  conversationId: string,
  message: string
) {
  // Get current user's profile ID to tag as human sender
  const { data: { user } } = await supabase.auth.getUser();
  let senderAgentId: string | null = null;
  if (user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    senderAgentId = profile?.id ?? null;
  }

  // Check which provider is connected
  const { data: connections } = await supabase
    .from("connection_configs")
    .select("connection_id, is_connected")
    .in("connection_id", ["zapi", "whatsapp"])
    .eq("is_connected", true);

  const zapiConnected = connections?.some((c) => c.connection_id === "zapi");

  // Prefer Z-API if connected, fallback to WhatsApp Cloud API
  const functionName = zapiConnected ? "zapi-send" : "whatsapp-send";

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { conversationId, message, senderAgentId },
  });

  if (error) throw error;
  return data;
}
