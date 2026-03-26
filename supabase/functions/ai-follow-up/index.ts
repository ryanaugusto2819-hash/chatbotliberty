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
    const currentHour = now.getUTCHours() - 3;
    const normalizedHour = currentHour < 0 ? currentHour + 24 : currentHour;

    // Get all active templates
    const { data: templates } = await supabase
      .from("follow_up_templates")
      .select("*")
      .eq("is_active", true)
      .order("escalation_level", { ascending: true });

    if (!templates?.length) {
      console.log("[ai-follow-up] No active templates");
      return jsonResponse({ processed: 0, reason: "No active templates" });
    }

    // Filter templates by active hours FIRST
    const activeTemplates = templates.filter((t: any) => {
      return normalizedHour >= t.active_hours_start && normalizedHour < t.active_hours_end;
    });

    if (!activeTemplates.length) {
      console.log(`[ai-follow-up] No templates active at hour ${normalizedHour}`);
      return jsonResponse({ processed: 0, reason: `No templates active at hour ${normalizedHour}` });
    }

    // Find minimum delay to filter conversations efficiently
    const minDelay = Math.min(...activeTemplates.map((t: any) => t.delay_hours));
    const cutoffTime = new Date(now.getTime() - minDelay * 60 * 60 * 1000).toISOString();

    // Get niche IDs from active templates
    const nicheIds = [...new Set(activeTemplates.map((t: any) => t.niche_id).filter(Boolean))];

    if (!nicheIds.length) {
      console.log("[ai-follow-up] No niches configured in active templates");
      return jsonResponse({ processed: 0, reason: "No niches in templates" });
    }

    // Only get conversations that:
    // 1. Are not resolved
    // 2. Belong to a niche with active templates
    // 3. Were updated before the minimum delay cutoff (haven't had activity recently)
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, contact_name, contact_phone, niche_id, status, updated_at, tags, ad_title, funnel_stage")
      .neq("status", "resolved")
      .in("niche_id", nicheIds)
      .lt("updated_at", cutoffTime)
      .order("updated_at", { ascending: true })
      .limit(30);

    if (!conversations?.length) {
      console.log(`[ai-follow-up] No eligible conversations (cutoff: ${cutoffTime})`);
      return jsonResponse({ processed: 0, reason: "No eligible conversations" });
    }

    console.log(`[ai-follow-up] Processing ${conversations.length} conversations (of ${nicheIds.length} niches)`);

    // Load niche data in parallel
    const [nichesRes, kbRes, stagesRes] = await Promise.all([
      supabase.from("niches").select("id, name, system_prompt").in("id", nicheIds),
      supabase.from("knowledge_base_items").select("title, content, niche_id").in("niche_id", nicheIds).limit(50),
      supabase.from("niche_funnel_stages").select("*").in("niche_id", nicheIds).order("sort_order"),
    ]);

    const nichesMap = new Map((nichesRes.data || []).map((n: any) => [n.id, n]));

    const nicheStagesMap = new Map<string, Map<string, { label: string; description: string; strategy: string }>>();
    for (const s of (stagesRes.data || [])) {
      if (!nicheStagesMap.has(s.niche_id)) nicheStagesMap.set(s.niche_id, new Map());
      nicheStagesMap.get(s.niche_id)!.set(s.stage_key, { label: s.label, description: s.description, strategy: s.strategy });
    }

    let totalSent = 0;

    for (const conv of conversations) {
      // Get recent messages for this conversation
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("sender_type, created_at, content, message_type, media_url")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!lastMessages?.length) continue;

      const lastMsg = lastMessages[0];
      // Skip if last message is from customer (they already responded, no need for follow-up)
      if (lastMsg.sender_type === "customer") continue;

      const lastMsgTime = new Date(lastMsg.created_at);
      const hoursSinceLastMsg = (now.getTime() - lastMsgTime.getTime()) / (1000 * 60 * 60);

      const nicheStages = conv.niche_id ? nicheStagesMap.get(conv.niche_id) || new Map() : new Map();
      const funnelStage = getFunnelStageInfo(conv.funnel_stage || "etapa_1", nicheStages);

      // Get existing follow-up executions
      const { data: existingExecs } = await supabase
        .from("follow_up_executions")
        .select("template_id, attempt_number, status")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false });

      const nicheTemplates = activeTemplates.filter((t: any) => t.niche_id === conv.niche_id);
      if (!nicheTemplates.length) continue;

      let sentForConv = false;

      for (const template of nicheTemplates) {
        if (sentForConv) break;

        // Check funnel stage match
        const templateStage = template.funnel_stage || 'all';
        const convStage = conv.funnel_stage || 'etapa_1';
        if (templateStage !== 'all' && templateStage !== convStage) continue;

        // Check delay
        if (hoursSinceLastMsg < template.delay_hours) continue;

        // Check attempts
        const templateExecs = (existingExecs || []).filter((e: any) => e.template_id === template.id);
        const attemptsDone = templateExecs.length;
        if (attemptsDone >= template.max_attempts) continue;

        // Check pending
        if (templateExecs.some((e: any) => e.status === "pending")) continue;

        // Check if customer responded after last follow-up
        const lastExec = templateExecs[0];
        if (lastExec && lastExec.status === "sent") {
          const customerMsgAfterFollowUp = lastMessages.find((m: any) => m.sender_type === "customer");
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

        // Build context
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

        const nicheKb = (kbRes.data || []).filter((k: any) => k.niche_id === conv.niche_id);
        const kbContext = nicheKb.length
          ? `\n\nBASE DE CONHECIMENTO DO NICHO:\n${nicheKb.map((k: any) => `- ${k.title}: ${k.content.substring(0, 300)}`).join("\n")}`
          : "";

        const nicheInfo = conv.niche_id ? nichesMap.get(conv.niche_id) : null;

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

        // Generate AI follow-up
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
          console.error(`[ai-follow-up] AI error for ${conv.contact_name}: ${aiResponse.status}`);
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

        // Insert execution
        await supabase.from("follow_up_executions").insert({
          conversation_id: conv.id,
          template_id: template.id,
          attempt_number: attemptsDone + 1,
          status: "pending",
          scheduled_at: now.toISOString(),
          message_sent: followUpMessage,
        });

        // Determine send function
        let sendFunction = "whatsapp-send";
        const sendBody: Record<string, unknown> = {
          to: conv.contact_phone,
          message: followUpMessage,
          conversationId: conv.id,
          senderLabel: "ia-follow-up",
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
          sentForConv = true;
          console.log(`[ai-follow-up] ✅ Sent to ${conv.contact_name} (template: ${template.name}, attempt: ${attemptsDone + 1}, funnel: ${funnelStage.label})`);
        } else {
          console.error(`[ai-follow-up] ❌ Failed to send to ${conv.contact_name}:`, await sendResp.text());
        }
      }
    }

    console.log(`[ai-follow-up] Finished: ${totalSent} sent`);
    return jsonResponse({ processed: totalSent });
  } catch (error) {
    console.error("[ai-follow-up] Error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
