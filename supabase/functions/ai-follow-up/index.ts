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

/** Get funnel stage info from database stages map */
function getFunnelStageInfo(
  stage: string,
  stagesMap: Map<string, { label: string; description: string; strategy: string }>
): { label: string; description: string; strategy: string } {
  const info = stagesMap.get(stage);
  if (info) return info;
  return {
    label: stage,
    description: "Etapa do funil",
    strategy: "Aborde o lead de forma natural, referenciando o contexto da conversa.",
  };
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

    // Get niche data for system prompts & knowledge base
    const nicheIds = [...new Set(templates.map((t: any) => t.niche_id).filter(Boolean))];
    const { data: nichesData } = nicheIds.length
      ? await supabase.from("niches").select("id, name, system_prompt").in("id", nicheIds)
      : { data: [] };
    const nichesMap = new Map((nichesData || []).map((n: any) => [n.id, n]));

    // Get knowledge base items for context
    const { data: kbItems } = nicheIds.length
      ? await supabase.from("knowledge_base_items").select("title, content, niche_id").in("niche_id", nicheIds).limit(50)
      : { data: [] };

    // Get funnel stages per niche
    const { data: allStages } = nicheIds.length
      ? await supabase.from("niche_funnel_stages").select("*").in("niche_id", nicheIds).order("sort_order")
      : { data: [] };
    // Build a map: niche_id -> Map<stage_key, {label, description, strategy}>
    const nicheStagesMap = new Map<string, Map<string, { label: string; description: string; strategy: string }>>();
    for (const s of (allStages || [])) {
      if (!nicheStagesMap.has(s.niche_id)) nicheStagesMap.set(s.niche_id, new Map());
      nicheStagesMap.get(s.niche_id)!.set(s.stage_key, { label: s.label, description: s.description, strategy: s.strategy });
    }

    // Find conversations that are NOT resolved
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, contact_name, contact_phone, niche_id, status, updated_at, tags, ad_title, funnel_stage")
      .neq("status", "resolved");

    if (!conversations?.length) {
      return jsonResponse({ processed: 0, reason: "No open conversations" });
    }

    let totalSent = 0;
    let totalSkipped = 0;

    for (const conv of conversations) {
      // Get more messages for richer context (up to 30)
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("sender_type, created_at, content, message_type, media_url")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!lastMessages?.length) continue;

      const lastMsg = lastMessages[0];
      // Skip if last message is from customer (they already responded)
      if (lastMsg.sender_type === "customer") continue;

      const lastMsgTime = new Date(lastMsg.created_at);
      const hoursSinceLastMsg = (now.getTime() - lastMsgTime.getTime()) / (1000 * 60 * 60);

      // Use the stored funnel stage from the conversation (set by flow actions)
      const nicheStages = conv.niche_id ? nicheStagesMap.get(conv.niche_id) || new Map() : new Map();
      const funnelStage = getFunnelStageInfo(conv.funnel_stage || "etapa_1", nicheStages);

      // Get existing follow-up executions for this conversation
      const { data: existingExecs } = await supabase
        .from("follow_up_executions")
        .select("template_id, attempt_number, status")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false });

      // Find the right template based on niche
      const nicheTemplates = templates.filter(
        (t: any) => t.niche_id === conv.niche_id
      );

      if (!nicheTemplates.length) continue;

      for (const template of nicheTemplates) {
        // Check if template matches the lead's funnel stage
        const templateStage = template.funnel_stage || 'all';
        const convStage = conv.funnel_stage || 'etapa_1';
        if (templateStage !== 'all' && templateStage !== convStage) {
          continue;
        }

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
            await supabase
              .from("follow_up_executions")
              .update({ status: "responded", responded_at: now.toISOString() })
              .eq("conversation_id", conv.id)
              .eq("template_id", template.id)
              .eq("status", "sent");
            continue;
          }
        }

        // Build rich context from conversation history
        const allMsgsChronological = [...lastMessages].reverse();
        const recentMessages = allMsgsChronological
          .map((m: any) => {
            let content = m.content || "";
            if (!content.trim()) {
              const labels: Record<string, string> = {
                image: "[Imagem enviada]", video: "[Vídeo enviado]", audio: "[Áudio enviado]",
                document: "[Documento enviado]", sticker: "[Sticker]",
              };
              content = labels[m.message_type] || "[Mídia]";
            }
            const timestamp = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
            return `[${timestamp}] ${m.sender_type === "customer" ? "Cliente" : "Agente"}: ${content}`;
          })
          .join("\n");

        // Get niche-specific knowledge base
        const nicheKb = (kbItems || []).filter((k: any) => k.niche_id === conv.niche_id);
        const kbContext = nicheKb.length
          ? `\n\nBASE DE CONHECIMENTO DO NICHO:\n${nicheKb.map((k: any) => `- ${k.title}: ${k.content.substring(0, 300)}`).join("\n")}`
          : "";

        // Get niche info
        const nicheInfo = conv.niche_id ? nichesMap.get(conv.niche_id) : null;

        // Build comprehensive system prompt
        const systemPrompt = `Você é um especialista em follow-up de vendas via WhatsApp. Gere uma mensagem de follow-up altamente personalizada com base no CONTEXTO COMPLETO da conversa e na ETAPA DO FUNIL em que o lead se encontra.

${nicheInfo ? `NICHO: ${nicheInfo.name}\nCONTEXTO DO NEGÓCIO: ${nicheInfo.system_prompt}` : ""}
${kbContext}

ETAPA DO FUNIL DO LEAD: ${funnelStage.label}
${funnelStage.description}

ESTRATÉGIA PARA ESTA ETAPA:
${funnelStage.strategy}

IMPORTANTE: A etapa do funil foi definida pelo fluxo de automação. Adapte 100% da sua abordagem a esta etapa específica.

${template.trigger_condition ? `CONDIÇÃO DE ATIVAÇÃO DESTE FOLLOW-UP:\n${template.trigger_condition}\nUse esta condição como contexto adicional para entender POR QUE este follow-up está sendo enviado.` : ""}

REGRAS:
1. A mensagem DEVE ser natural, como se fosse de um humano real, não um robô.
2. NÃO use saudações genéricas como "Olá, tudo bem?" ou "Boa tarde!".
3. FAÇA referência ESPECÍFICA ao contexto da conversa — mencione o que o cliente falou, perguntou ou demonstrou interesse.
4. Nível de urgência: ${template.escalation_level} de ${nicheTemplates.length} (1=suave e amigável, mais alto=mais direto/urgente com senso de escassez).
5. Tentativa ${attemptsDone + 1} de ${template.max_attempts} para este nível.
6. Objetivo e instruções deste follow-up: ${template.objective}
7. Use como base o modelo: "${template.message_template}" — mas ADAPTE COMPLETAMENTE ao contexto real da conversa.
8. Mantenha a mensagem curta (máx 3-4 linhas).
9. Use emojis com moderação (máx 2).
10. NUNCA mencione que é um robô, IA ou sistema automatizado.
11. Se o lead mencionou um produto/serviço específico, FOQUE nele.
12. ${conv.ad_title ? `O lead veio do anúncio: "${conv.ad_title}". Use isso como contexto se relevante.` : ""}
13. ${(conv.tags || []).length > 0 ? `Tags do contato: ${conv.tags!.join(", ")}. Podem indicar interesses ou estágio.` : ""}`;

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
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Nome do cliente: ${conv.contact_name}
Etapa do funil: ${funnelStage.label}
Horas sem resposta: ${Math.round(hoursSinceLastMsg)}h
Status da conversa: ${conv.status}

HISTÓRICO COMPLETO DA CONVERSA:
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
        const sendBody: Record<string, unknown> = {
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
          console.log(`Follow-up sent to ${conv.contact_name} (template: ${template.name}, attempt: ${attemptsDone + 1}, funnel: ${funnelStage.label})`);
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
