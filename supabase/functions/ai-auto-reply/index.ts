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
    const { conversationId } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if auto-reply is enabled
    const { data: config } = await supabase
      .from("connection_configs")
      .select("config")
      .eq("connection_id", "ai-auto-reply")
      .maybeSingle();

    const aiConfig = config?.config as Record<string, unknown> | null;
    if (!aiConfig?.enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Auto-reply disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = (aiConfig?.system_prompt as string) ||
      "Você é um assistente virtual amigável. Responda de forma concisa e útil em português brasileiro.";

    // Fetch knowledge base items for context
    const { data: kbItems } = await supabase
      .from("knowledge_base_items")
      .select("type, title, content")
      .order("created_at", { ascending: true })
      .limit(50);

    let knowledgeContext = "";
    if (kbItems && kbItems.length > 0) {
      const sections: string[] = [];
      for (const item of kbItems) {
        if (item.type === "qa") {
          sections.push(`Pergunta: ${item.title}\nResposta: ${item.content}`);
        } else if (item.type === "text") {
          sections.push(`[${item.title}]\n${item.content}`);
        } else if (item.type === "file") {
          sections.push(`[Arquivo: ${item.title}]\n${item.content}`);
        }
      }
      knowledgeContext = "\n\n--- BASE DE CONHECIMENTO ---\nUse as informações abaixo para responder com precisão:\n\n" + sections.join("\n\n");
    }

    const fullSystemPrompt = systemPrompt + knowledgeContext;

    // Fetch last 20 messages for context
    const { data: messages } = await supabase
      .from("messages")
      .select("content, sender_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No messages" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build chat history for AI
    const chatMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m) => ({
        role: m.sender_type === "customer" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const replyContent = aiResult.choices?.[0]?.message?.content;

    if (!replyContent) {
      return new Response(
        JSON.stringify({ error: "Empty AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send reply via WhatsApp
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
      console.error("WhatsApp credentials missing for auto-reply");
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conversation.contact_phone,
          type: "text",
          text: { body: replyContent },
        }),
      }
    );

    const waResult = await waResponse.json();

    if (!waResponse.ok) {
      console.error("WhatsApp send error:", waResult);
      return new Response(
        JSON.stringify({ error: "Failed to send auto-reply", details: waResult }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save AI reply to database
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      content: replyContent,
      sender_type: "agent",
      message_type: "text",
      status: "sent",
    });

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ success: true, reply: replyContent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-reply error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
