import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId } = await req.json();

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: "messageId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the message to get provider_message_id and conversation info
    const { data: message, error: fetchError } = await serviceClient
      .from("messages")
      .select("id, provider_message_id, conversation_id, sender_type")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return new Response(
        JSON.stringify({ error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to delete from WhatsApp if it's an agent message with provider_message_id
    let whatsappDeleted = false;
    if (message.provider_message_id && message.sender_type === "agent") {
      try {
        // Get conversation to find the connection
        const { data: conv } = await serviceClient
          .from("conversations")
          .select("connection_config_id, niche_id")
          .eq("id", message.conversation_id)
          .single();

        if (conv?.connection_config_id) {
          const { data: connConfig } = await serviceClient
            .from("connection_configs")
            .select("config, connection_id")
            .eq("id", conv.connection_config_id)
            .single();

          if (connConfig) {
            const cfg = connConfig.config as Record<string, string>;

            if (connConfig.connection_id === "whatsapp" && cfg?.access_token && cfg?.phone_number_id) {
              // Meta Cloud API — delete message
              const deleteRes = await fetch(
                `https://graph.facebook.com/v21.0/${cfg.phone_number_id}/messages/${message.provider_message_id}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${cfg.access_token}` },
                }
              );
              whatsappDeleted = deleteRes.ok;
              if (!deleteRes.ok) {
                console.log(`WhatsApp delete failed: ${deleteRes.status} — ${await deleteRes.text()}`);
              }
            } else if (connConfig.connection_id === "zapi" && cfg?.instance_id && cfg?.token) {
              // Z-API — delete message
              const zapiRes = await fetch(
                `https://api.z-api.io/instances/${cfg.instance_id}/token/${cfg.token}/messages/${message.provider_message_id}`,
                { method: "DELETE" }
              );
              whatsappDeleted = zapiRes.ok;
            }
          }
        }
      } catch (err) {
        console.error("WhatsApp delete error (non-blocking):", err);
      }
    }

    // Delete from database
    const { error: deleteError } = await serviceClient
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: "Failed to delete message", details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, whatsappDeleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("delete-message error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
