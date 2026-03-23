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
    const { conversationId, message, type = "text" } = await req.json();

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
      .select("contact_phone, niche_id")
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

    // Strategy 1: If conversation has a niche, use the niche's phone_number_id to find the connection
    if (conversation.niche_id) {
      const { data: niche } = await serviceClient
        .from("niches")
        .select("whatsapp_phone_number_id")
        .eq("id", conversation.niche_id)
        .single();

      if (niche?.whatsapp_phone_number_id) {
        // Find the connection_config that has this phone_number_id
        const { data: connections } = await serviceClient
          .from("connection_configs")
          .select("config")
          .eq("connection_id", "whatsapp")
          .eq("is_connected", true);

        const match = connections?.find((c: any) => {
          const cfg = c.config as Record<string, string>;
          return cfg?.phone_number_id === niche.whatsapp_phone_number_id;
        });

        if (match) {
          const cfg = match.config as Record<string, string>;
          phoneNumberId = cfg.phone_number_id;
          accessToken = cfg.access_token || null;
          console.log(`[whatsapp-send] Resolved connection via niche: phoneNumberId=${phoneNumberId}`);
        }
      }
    }

    // Strategy 2: Fallback — pick the most recently updated whatsapp connection
    if (!phoneNumberId || !accessToken) {
      const { data: fallbackConn } = await serviceClient
        .from("connection_configs")
        .select("config")
        .eq("connection_id", "whatsapp")
        .eq("is_connected", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackConn) {
        const cfg = fallbackConn.config as Record<string, string>;
        if (cfg?.phone_number_id) phoneNumberId = cfg.phone_number_id;
        if (cfg?.access_token) accessToken = cfg.access_token;
        console.log(`[whatsapp-send] Using fallback connection: phoneNumberId=${phoneNumberId}`);
      }
    }

    // Strategy 3: Final fallback to env vars
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

    if (!waResponse.ok) {
      console.error("WhatsApp API error:", waResult);

      // Save failed message so user can see it in chat
      const { data: failedMsg } = await serviceClient
        .from("messages")
        .insert({
          conversation_id: conversationId,
          content: message,
          sender_type: "agent",
          sender_agent_id: null,
          message_type: type,
          status: "failed",
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

    // Save message to database
    const { data: savedMsg, error: msgError } = await serviceClient
      .from("messages")
      .insert({
        conversation_id: conversationId,
        content: message,
        sender_type: "agent",
        sender_agent_id: null,
        message_type: type,
        status: "sent",
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error saving message:", msgError);
    }

    // Update conversation timestamp
    await serviceClient
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: waResult.messages?.[0]?.id,
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
