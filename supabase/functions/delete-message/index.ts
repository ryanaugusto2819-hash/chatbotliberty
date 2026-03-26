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

    // Fetch the message
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

    // Try to delete from WhatsApp/Z-API
    let whatsappDeleted = false;
    let whatsappError: string | null = null;

    if (message.provider_message_id) {
      try {
        const { data: conv } = await serviceClient
          .from("conversations")
          .select("connection_config_id, contact_phone")
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
              // Meta Cloud API — delete message for everyone
              // POST to /{phone_number_id}/messages with message_id
              const deleteRes = await fetch(
                `https://graph.facebook.com/v21.0/${cfg.phone_number_id}/messages`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${cfg.access_token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    messaging_product: "whatsapp",
                    message_id: message.provider_message_id,
                  }),
                }
              );

              if (deleteRes.ok) {
                whatsappDeleted = true;
              } else {
                const errBody = await deleteRes.text();
                console.error(`Meta delete failed [${deleteRes.status}]: ${errBody}`);
                try {
                  const parsed = JSON.parse(errBody);
                  const metaErr = parsed?.error;
                  whatsappError = metaErr?.error_user_msg || metaErr?.message || `Erro ${deleteRes.status}`;
                } catch {
                  whatsappError = `Erro HTTP ${deleteRes.status}`;
                }
              }
            } else if (connConfig.connection_id === "zapi" && cfg?.instance_id && cfg?.token) {
              // Z-API — delete message
              const phone = conv.contact_phone?.replace(/\D/g, "") || "";
              const zapiRes = await fetch(
                `https://api.z-api.io/instances/${cfg.instance_id}/token/${cfg.token}/delete-message`,
                {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json", ...(cfg.client_token ? { "Client-Token": cfg.client_token } : {}) },
                  body: JSON.stringify({
                    phone,
                    messageId: message.provider_message_id,
                    owner: message.sender_type === "agent",
                  }),
                }
              );

              if (zapiRes.ok) {
                whatsappDeleted = true;
              } else {
                const errText = await zapiRes.text();
                console.error(`Z-API delete failed [${zapiRes.status}]: ${errText}`);
                whatsappError = `Erro Z-API: ${zapiRes.status}`;
              }
            }
          }
        }
      } catch (err) {
        console.error("WhatsApp delete error:", err);
        whatsappError = err instanceof Error ? err.message : "Erro desconhecido";
      }
    } else {
      whatsappError = "Mensagem sem ID do provedor — não é possível excluir do WhatsApp";
    }

    // Always delete from database
    const { error: deleteError } = await serviceClient
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: "Failed to delete from database", details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, whatsappDeleted, whatsappError }),
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
