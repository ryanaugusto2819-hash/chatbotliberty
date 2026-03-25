import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return jsonResponse({ error: "conversationId is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch conversation to get niche_id
    const { data: conversation } = await supabase
      .from("conversations")
      .select("contact_phone, niche_id")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return jsonResponse({ error: "Conversation not found" }, 404);
    }

    const nicheId = conversation.niche_id;

    // Load niche-specific config OR global config
    let aiEnabled = false;
    let systemPrompt = "Você é um assistente virtual amigável. Responda de forma concisa e útil em português brasileiro.";

    if (nicheId) {
      const { data: niche } = await supabase
        .from("niches")
        .select("auto_reply_enabled, system_prompt")
        .eq("id", nicheId)
        .single();

      if (niche) {
        aiEnabled = niche.auto_reply_enabled;
        systemPrompt = niche.system_prompt || systemPrompt;
      }
    } else {
      // Fallback to global config
      const { data: config } = await supabase
        .from("connection_configs")
        .select("config")
        .eq("connection_id", "ai-auto-reply")
        .maybeSingle();

      const aiConfig = config?.config as Record<string, unknown> | null;
      aiEnabled = !!aiConfig?.enabled;
      if (aiConfig?.system_prompt) systemPrompt = aiConfig.system_prompt as string;
    }

    if (!aiEnabled) {
      return jsonResponse({ skipped: true, reason: "Auto-reply disabled" });
    }

    // Fetch knowledge base items filtered by niche
    let kbQuery = supabase
      .from("knowledge_base_items")
      .select("type, title, content")
      .order("created_at", { ascending: true })
      .limit(50);

    if (nicheId) {
      kbQuery = kbQuery.eq("niche_id", nicheId);
    } else {
      kbQuery = kbQuery.is("niche_id", null);
    }

    const { data: kbItems } = await kbQuery;

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

    // Fetch last 20 messages (include media info for vision)
    const { data: messages } = await supabase
      .from("messages")
      .select("content, sender_type, created_at, message_type, media_url")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!messages?.length) {
      return jsonResponse({ skipped: true, reason: "No messages" });
    }

    // Build chat messages with multimodal support for images
    const chatMessages: Array<{ role: string; content: unknown }> = [
      { role: "system", content: fullSystemPrompt },
    ];

    for (const m of messages) {
      const role = m.sender_type === "customer" ? "user" : "assistant";
      const hasImage = m.message_type === "image" && m.media_url;

      if (hasImage && role === "user") {
        // Send image as multimodal content (vision) for customer messages
        const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

        if (m.content?.trim()) {
          parts.push({ type: "text", text: m.content });
        } else {
          parts.push({ type: "text", text: "O cliente enviou esta imagem:" });
        }

        parts.push({
          type: "image_url",
          image_url: { url: m.media_url },
        });

        chatMessages.push({ role, content: parts });
      } else {
        // Text-only message (or non-image media as text description)
        let text = m.content || "";
        if (!text.trim() && m.message_type !== "text") {
          const labels: Record<string, string> = {
            audio: "[Áudio enviado]",
            video: "[Vídeo enviado]",
            document: "[Documento enviado]",
            sticker: "[Sticker enviado]",
          };
          text = labels[m.message_type] || "[Mídia enviada]";
        }
        chatMessages.push({ role, content: text });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return jsonResponse({ error: "AI not configured" }, 500);
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
      if (aiResponse.status === 429) return jsonResponse({ error: "Rate limit exceeded" }, 429);
      if (aiResponse.status === 402) return jsonResponse({ error: "AI credits exhausted" }, 402);
      return jsonResponse({ error: "AI generation failed" }, 502);
    }

    const aiResult = await aiResponse.json();
    const replyContent = aiResult.choices?.[0]?.message?.content;

    const usage = aiResult.usage;
    if (usage) {
      await supabase.from("ai_usage_logs").insert({
        function_name: "ai-auto-reply",
        model: "google/gemini-3-flash-preview",
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
        conversation_id: conversationId,
      });
    }

    if (!replyContent) {
      return jsonResponse({ error: "Empty AI response" }, 500);
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
      return jsonResponse({ error: "WhatsApp not configured" }, 500);
    }

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
      return jsonResponse({ error: "Failed to send auto-reply", details: waResult }, 502);
    }

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

    return jsonResponse({ success: true, reply: replyContent });
  } catch (error) {
    console.error("Auto-reply error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
