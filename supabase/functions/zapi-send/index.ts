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
    const zapiResponse = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          message,
        }),
      }
    );

    const zapiResult = await zapiResponse.json();

    if (!zapiResponse.ok) {
      console.error("Z-API send error:", zapiResult);
      return new Response(
        JSON.stringify({ error: "Failed to send message via Z-API", details: zapiResult }),
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
        zapiMessageId: zapiResult.messageId,
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
