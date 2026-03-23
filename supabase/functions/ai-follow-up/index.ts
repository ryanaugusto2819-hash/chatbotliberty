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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI not configured" }, 500);
    }

    const now = new Date();
    const currentHour = now.getUTCHours() - 3; // BRT approximation

    // Get all active templates
    const { data: templates } = await supabase
      .from("follow_up_templates")
      .select("*")
      .eq("is_active", true)
      .order("escalation_level", { ascending: true });

    if (!templates?.length) {
      return jsonResponse({ processed: 0, reason: "No active templates" });
    }

    // Find conversations with no customer response in the last N hours
    // Get conversations that are NOT resolved
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, contact_name, contact_phone, niche_id, status, updated_at")
      .neq("status", "resolved");

    if (!conversations?.length) {
      return jsonResponse({ processed: 0, reason: "No open conversations" });
    }

    let totalSent = 0;
    let totalSkipped = 0;

    for (const conv of conversations) {
      // Get last message
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("sender_type, created_at, content, message_type")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!lastMessages?.length) continue;

      const lastMsg = lastMessages[0];
      // Skip if last message is from customer (they already responded)
      if (lastMsg.sender_type === "customer") continue;

      const lastMsgTime = new Date(lastMsg.created_at);
      const hoursSinceLastMsg = (now.getTime() - lastMsgTime.getTime()) / (1000 * 60 * 60);

      // Get existing follow-up executions for this conversation
      const { data: existingExecs } = await supabase
        .from("follow_up_executions")
        .select("template_id, attempt_number, status")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false });

      // Find the right template based on escalation
      const nicheTemplates = templates.filter(
        (t: any) => !t.niche_id || t.niche_id === conv.niche_id
      );

      for (const template of nicheTemplates) {
        // Check active hours
        const normalizedHour = currentHour < 0 ? currentHour + 24 : currentHour;
        if (normalizedHour < template.active_hours_start || normalizedHour >= template.active_hours_end) {
          continue;
        }

        // Check if enough time has passed
        if (hoursSinceLastMsg < template.delay_hours) continue;

        // Check attempts for this template
        const templateExecs = (existingExecs || []).filter(
          (e: any) => e.template_id === template.id
        );
        const attemptsDone = templateExecs.length;

        if (attemptsDone >= template.max_attempts) continue;

        // Check if already has a pending execution
        const hasPending = templateExecs.some((e: any) => e.status === "pending");
        if (hasPending) continue;

        // Check if customer responded after last follow-up
        const lastExec = templateExecs[0];
        if (lastExec && lastExec.status === "sent") {
          const customerMsgAfterFollowUp = lastMessages.find(
            (m: any) => m.sender_type === "customer"
          );
          if (customerMsgAfterFollowUp) {
            // Mark as responded
            await supabase
              .from("follow_up_executions")
              .update({ status: "responded", responded_at: now.toISOString() })
              .eq("conversation_id", conv.id)
              .eq("template_id", template.id)
              .eq("status", "sent");
            continue;
          }
        }

        // Build context from last messages
        const recentMessages = lastMessages
          .reverse()
          .map((m: any) => {
            let content = m.content || "";
            if (!content.trim()) {
              const labels: Record<string, string> = {
                image: "[Imagem]", video: "[Vídeo]", audio: "[Áudio]",
              };
              content = labels[m.message_type] || "[Mídia]";
            }
            return `${m.sender_type === "customer" ? "Cliente" : "Agente"}: ${content}`;
          })
          .join("\n");

        // Use AI to generate personalized follow-up
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um especialista em follow-up de vendas via WhatsApp. Gere uma mensagem de follow-up personalizada.

REGRAS:
1. A mensagem deve ser natural, como se fosse de um humano.
2. Não use saudações genéricas como "Olá, tudo bem?".
3. Faça referência ao contexto da conversa anterior.
4. Nível de urgência atual: ${template.escalation_level} de ${nicheTemplates.length} (1=suave, mais alto=mais direto/urgente).
5. Tentativa ${attemptsDone + 1} de ${template.max_attempts}.
6. O objetivo deste follow-up é: ${template.objective}
7. Use como base o modelo: "${template.message_template}" mas adapte ao contexto.
8. Mantenha a mensagem curta (máx 3 linhas).
9. Use emojis com moderação.
10. NUNCA mencione que é um robô ou IA.`,
              },
              {
                role: "user",
                content: `Nome do cliente: ${conv.contact_name}
Conversa recente:
${recentMessages}

Gere a mensagem de follow-up:`,
              },
            ],
            stream: false,
          }),
        });

        if (!aiResponse.ok) {
          console.error("AI error:", aiResponse.status);
          continue;
        }

        const aiResult = await aiResponse.json();
        const followUpMessage = aiResult.choices?.[0]?.message?.content?.trim();

        if (!followUpMessage) continue;

        // Log AI usage
        const usage = aiResult.usage;
        if (usage) {
          await supabase.from("ai_usage_logs").insert({
            function_name: "ai-follow-up",
            model: "google/gemini-3-flash-preview",
            input_tokens: usage.prompt_tokens || 0,
            output_tokens: usage.completion_tokens || 0,
            total_tokens: usage.total_tokens || 0,
            conversation_id: conv.id,
          });
        }

        // Insert follow-up execution as pending
        await supabase.from("follow_up_executions").insert({
          conversation_id: conv.id,
          template_id: template.id,
          attempt_number: attemptsDone + 1,
          status: "pending",
          scheduled_at: now.toISOString(),
          message_sent: followUpMessage,
        });

        // Determine which send function to use based on niche connection
        let sendFunction = "whatsapp-send";
        let sendBody: Record<string, unknown> = {
          to: conv.contact_phone,
          message: followUpMessage,
          conversationId: conv.id,
        };

        if (conv.niche_id) {
          const { data: nicheConn } = await supabase
            .from("niche_connections")
            .select("connection_config_id")
            .eq("niche_id", conv.niche_id)
            .limit(1)
            .maybeSingle();

          if (nicheConn) {
            const { data: connConfig } = await supabase
              .from("connection_configs")
              .select("connection_id")
              .eq("id", nicheConn.connection_config_id)
              .single();

            if (connConfig?.connection_id?.startsWith("zapi")) {
              sendFunction = "zapi-send";
            }
          }
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const sendResp = await fetch(`${supabaseUrl}/functions/v1/${sendFunction}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sendBody),
        });

        if (sendResp.ok) {
          await supabase
            .from("follow_up_executions")
            .update({ status: "sent", sent_at: now.toISOString() })
            .eq("conversation_id", conv.id)
            .eq("template_id", template.id)
            .eq("attempt_number", attemptsDone + 1);

          totalSent++;
          console.log(`Follow-up sent to ${conv.contact_name} (template: ${template.name}, attempt: ${attemptsDone + 1})`);
        } else {
          console.error(`Failed to send follow-up to ${conv.contact_name}:`, await sendResp.text());
        }

        // Only send one follow-up per conversation per cycle
        break;
      }
    }

    return jsonResponse({ processed: totalSent, skipped: totalSkipped });
  } catch (error) {
    console.error("Follow-up error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
