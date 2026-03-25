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
    const { conversationId, message, type = "text", senderAgentId = null, senderLabel = null } = await req.json();

    if (!conversationId || !message) {
      return new Response(
        JSON.stringify({ error: "conversationId and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get conversation with niche info
    const { data: conversation, error: convError } = await serviceClient
      .from("conversations")
      .select("contact_phone, niche_id, connection_config_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Resolve the correct WhatsApp connection for this conversation
    let phoneNumberId: string | null = null;
    let accessToken: string | null = null;

    // Strategy 1: Prefer the exact connection stored on the conversation
    if (conversation.connection_config_id) {
      const { data: directConnection } = await serviceClient
        .from("connection_configs")
        .select("id, connection_id, config")
        .eq("id", conversation.connection_config_id)
        .eq("connection_id", "whatsapp")
        .eq("is_connected", true)
        .maybeSingle();

      if (directConnection) {
        const cfg = directConnection.config as Record<string, string>;
        if (cfg?.phone_number_id && cfg?.access_token) {
          phoneNumberId = cfg.phone_number_id;
          accessToken = cfg.access_token;
          console.log(
            `[whatsapp-send] Using conversation connection: configId=${directConnection.id}, phoneNumberId=${phoneNumberId}`
          );
        }
      }
    }

    // Strategy 2: Prefer whatsapp connections explicitly linked to the niche
    if ((!phoneNumberId || !accessToken) && conversation.niche_id) {
      const { data: nicheConnections } = await serviceClient
        .from("niche_connections")
        .select("connection_config_id")
        .eq("niche_id", conversation.niche_id);

      const linkedConfigIds = nicheConnections?.map((item: any) => item.connection_config_id) || [];

      if (linkedConfigIds.length > 0) {
        const { data: linkedConnections } = await serviceClient
          .from("connection_configs")
          .select("id, config, updated_at")
          .in("id", linkedConfigIds)
          .eq("connection_id", "whatsapp")
          .eq("is_connected", true)
          .order("updated_at", { ascending: false });

        const linkedMatch = linkedConnections?.find((connection: any) => {
          const cfg = connection.config as Record<string, string>;
          return cfg?.phone_number_id && cfg?.access_token;
        });

        if (linkedMatch) {
          const cfg = linkedMatch.config as Record<string, string>;
          phoneNumberId = cfg.phone_number_id || null;
          accessToken = cfg.access_token || null;
          console.log(
            `[whatsapp-send] Resolved linked niche connection: configId=${linkedMatch.id}, phoneNumberId=${phoneNumberId}`
          );
        }
      }
    }

    // Strategy 3: Legacy fallback using the niche default phone number id
    if ((!phoneNumberId || !accessToken) && conversation.niche_id) {
      const { data: niche } = await serviceClient
        .from("niches")
        .select("whatsapp_phone_number_id")
        .eq("id", conversation.niche_id)
        .single();

      if (niche?.whatsapp_phone_number_id) {
        const { data: connections } = await serviceClient
          .from("connection_configs")
          .select("id, config")
          .eq("connection_id", "whatsapp")
          .eq("is_connected", true);

        const match = connections?.find((c: any) => {
          const cfg = c.config as Record<string, string>;
          return cfg?.phone_number_id === niche.whatsapp_phone_number_id;
        });

        if (match) {
          const cfg = match.config as Record<string, string>;
          phoneNumberId = cfg.phone_number_id || null;
          accessToken = cfg.access_token || null;
          console.log(
            `[whatsapp-send] Resolved legacy niche phone_number_id via configId=${match.id}: phoneNumberId=${phoneNumberId}`
          );
        }
      }
    }

    // Strategy 4: Fallback — pick the most recently updated whatsapp connection
    if (!phoneNumberId || !accessToken) {
      const { data: fallbackConn } = await serviceClient
        .from("connection_configs")
        .select("id, config")
        .eq("connection_id", "whatsapp")
        .eq("is_connected", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackConn) {
        const cfg = fallbackConn.config as Record<string, string>;
        if (cfg?.phone_number_id) phoneNumberId = cfg.phone_number_id;
        if (cfg?.access_token) accessToken = cfg.access_token;
        console.log(
          `[whatsapp-send] Using fallback connection via configId=${fallbackConn.id}: phoneNumberId=${phoneNumberId}`
        );
      }
    }

    // Strategy 5: Final fallback to env vars
    if (!phoneNumberId) phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || null;
    if (!accessToken) accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || null;

    if (!phoneNumberId || !accessToken) {
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials are missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize Brazilian phone numbers (add 9th digit if missing)
    let phone = conversation.contact_phone.replace(/\D/g, "");
    if (phone.startsWith("55") && phone.length === 12) {
      const ddd = phone.substring(2, 4);
      const localNumber = phone.substring(4);
      if (!localNumber.startsWith("9")) {
        phone = `55${ddd}9${localNumber}`;
        console.log(`Normalized phone: ${conversation.contact_phone} -> ${phone}`);
      }
    }

    console.log(`[whatsapp-send] phoneNumberId=${phoneNumberId}, to=${phone}, original=${conversation.contact_phone}`);
    const waResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const waResult = await waResponse.json();
    const providerMessageId = waResult?.messages?.[0]?.id || null;
    const providerError = waResult?.error
      ? JSON.stringify(waResult.error).slice(0, 500)
      : !providerMessageId
        ? "WhatsApp accepted the request without returning a message id"
        : null;

    if (!waResponse.ok || providerError) {
      console.error("WhatsApp API error:", waResult);

      const { data: failedMsg } = await serviceClient
        .from("messages")
        .insert({
          conversation_id: conversationId,
          content: message,
          sender_type: "agent",
          sender_agent_id: senderAgentId,
          message_type: type,
          status: "failed",
          provider_status: "failed",
          provider_error: providerError,
          sender_label: senderLabel || (senderAgentId ? "humano" : null),
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ error: "Failed to send message", details: waResult, savedMessage: failedMsg }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: savedMsg, error: msgError } = await serviceClient
      .from("messages")
      .insert({
        conversation_id: conversationId,
        content: message,
        sender_type: "agent",
        sender_agent_id: senderAgentId,
        message_type: type,
        status: "pending",
        provider_message_id: providerMessageId,
        provider_status: "accepted",
        sender_label: senderLabel || (senderAgentId ? "humano" : null),
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error saving message:", msgError);
    }

    await serviceClient
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: providerMessageId,
        savedMessage: savedMsg,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
