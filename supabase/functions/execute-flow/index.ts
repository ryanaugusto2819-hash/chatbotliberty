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
    const { flowId, conversationId } = await req.json();

    if (!flowId || !conversationId) {
      return new Response(
        JSON.stringify({ error: "flowId and conversationId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .select("contact_phone")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp credentials
    const { data: waConfig } = await supabase
      .from("connection_configs")
      .select("config")
      .eq("connection_id", "whatsapp")
      .eq("is_connected", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const waConfigData = waConfig?.config as Record<string, unknown> | null;
    const phoneNumberId =
      (typeof waConfigData?.phone_number_id === "string" && waConfigData.phone_number_id.trim())
        ? waConfigData.phone_number_id
        : Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (!phoneNumberId || !accessToken) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get nodes sorted by edges (topological order via sort_order)
    const { data: nodes } = await supabase
      .from("automation_nodes")
      .select("*")
      .eq("flow_id", flowId)
      .order("sort_order", { ascending: true });

    if (!nodes?.length) {
      return new Response(
        JSON.stringify({ error: "No nodes in flow" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { nodeId: string; status: string }[] = [];

    for (const node of nodes) {
      const config = node.config as Record<string, unknown>;

      if (node.node_type === "trigger") {
        results.push({ nodeId: node.id, status: "started" });
        continue;
      }

      if (node.node_type === "delay") {
        const seconds = (config.delay_seconds as number) || 5;
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        results.push({ nodeId: node.id, status: `delayed ${seconds}s` });
        continue;
      }

      // Build WhatsApp message payload
      let waPayload: Record<string, unknown>;

      if (node.node_type === "message") {
        waPayload = {
          messaging_product: "whatsapp",
          to: conversation.contact_phone,
          type: "text",
          text: { body: config.content || "" },
        };
      } else if (node.node_type === "image") {
        waPayload = {
          messaging_product: "whatsapp",
          to: conversation.contact_phone,
          type: "image",
          image: { link: config.media_url, caption: config.caption || undefined },
        };
      } else if (node.node_type === "audio") {
        waPayload = {
          messaging_product: "whatsapp",
          to: conversation.contact_phone,
          type: "audio",
          audio: { link: config.media_url },
        };
      } else if (node.node_type === "video") {
        waPayload = {
          messaging_product: "whatsapp",
          to: conversation.contact_phone,
          type: "video",
          video: { link: config.media_url, caption: config.caption || undefined },
        };
      } else {
        results.push({ nodeId: node.id, status: "skipped" });
        continue;
      }

      // Send via WhatsApp API
      const waResponse = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(waPayload),
        }
      );

      const waResult = await waResponse.json();

      if (!waResponse.ok) {
        console.error("WhatsApp send error:", waResult);
        results.push({ nodeId: node.id, status: "error" });
        continue;
      }

      // Save message to DB
      const msgContent =
        node.node_type === "message"
          ? (config.content as string)
          : node.node_type === "image"
          ? (config.caption as string) || "[Imagem]"
          : node.node_type === "audio"
          ? "[Áudio]"
          : (config.caption as string) || "[Vídeo]";

      const normalizedType = ["text", "image", "audio"].includes(node.node_type)
        ? node.node_type === "message" ? "text" : node.node_type
        : "text";

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        content: msgContent,
        sender_type: "agent",
        message_type: normalizedType,
        status: "sent",
      });

      results.push({ nodeId: node.id, status: "sent" });
    }

    // Update trigger count
    await supabase.rpc("increment_trigger_count" as never, { flow_id_param: flowId } as never).catch(() => {
      // Fallback: manual update
      supabase
        .from("automation_flows")
        .update({ trigger_count: nodes.length })
        .eq("id", flowId);
    });

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Execute flow error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
