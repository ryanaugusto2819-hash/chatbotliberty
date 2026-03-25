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
    const { conversationId, message, type = "text", senderAgentId = null } = await req.json();

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

    // Get conversation phone
    const { data: conversation, error: convError } = await serviceClient
      .from("conversations")
      .select("contact_phone")
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

    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const token = Deno.env.get("ZAPI_TOKEN");

    if (!instanceId || !token) {
      return new Response(
        JSON.stringify({ error: "Z-API credentials are missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Z-API send text message endpoint
    const phone = conversation.contact_phone.replace(/\D/g, "");

    // Get client-token from connection_configs or env
    const { data: zapiConfig } = await serviceClient
      .from("connection_configs")
      .select("config")
      .eq("connection_id", "zapi")
      .eq("is_connected", true)
      .maybeSingle();

    const configData = zapiConfig?.config as Record<string, unknown> | null;
    const clientToken = (configData?.client_token as string) || Deno.env.get("ZAPI_CLIENT_TOKEN") || "";

    const zapiResponse = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify({
          phone,
          message,
        }),
      }
    );

    const zapiResult = await zapiResponse.json();
    const providerMessageId = zapiResult?.messageId || zapiResult?.zaapId || null;
    const providerError = zapiResult?.error
      ? JSON.stringify(zapiResult.error).slice(0, 500)
      : !providerMessageId
        ? null
        : null;

    if (!zapiResponse.ok || providerError) {
      console.error("Z-API send error:", zapiResult);

      const { data: failedMsg } = await serviceClient
        .from("messages")
        .insert({
          conversation_id: conversationId,
          content: message,
          sender_type: "agent",
          sender_agent_id: null,
          message_type: type,
          status: "failed",
          provider_status: "failed",
          provider_error: providerError,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ error: "Failed to send message via Z-API", details: zapiResult, savedMessage: failedMsg }),
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
        sender_agent_id: null,
        message_type: type,
        status: providerMessageId ? "pending" : "sent",
        provider_message_id: providerMessageId,
        provider_status: providerMessageId ? "accepted" : null,
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
        zapiMessageId: providerMessageId,
        savedMessage: savedMsg,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Z-API send error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
