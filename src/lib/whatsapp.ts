import { supabase } from "@/integrations/supabase/client";

export async function sendWhatsAppMessage(
  conversationId: string,
  message: string
) {
  const { data, error } = await supabase.functions.invoke("whatsapp-send", {
    body: { conversationId, message },
  });

  if (error) throw error;
  return data;
}
