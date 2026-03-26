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

    console.log(`[ai-follow-up] ⏰ Hora atual (BRT): ${normalizedHour}h | UTC: ${now.toISOString()}`);

    // Get all active templates
    const { data: templates } = await supabase
      .from("follow_up_templates")
      .select("*")
      .eq("is_active", true)
      .order("escalation_level", { ascending: true });

    if (!templates?.length) {
      console.log("[ai-follow-up] ❌ Nenhum template ativo encontrado");
      return jsonResponse({ processed: 0, reason: "No active templates" });
    }

    console.log(`[ai-follow-up] 📋 Templates ativos: ${templates.length} → ${templates.map((t: any) => `${t.name} (nicho: ${t.niche_id?.slice(0,8)}, etapa: ${t.funnel_stage}, horário: ${t.active_hours_start}-${t.active_hours_end}h)`).join(" | ")}`);

    // Filter templates by active hours
    const activeTemplates = templates.filter((t: any) => {
      return normalizedHour >= t.active_hours_start && normalizedHour < t.active_hours_end;
    });

    if (!activeTemplates.length) {
      console.log(`[ai-follow-up] ❌ Nenhum template ativo na hora ${normalizedHour}. Templates: ${templates.map((t: any) => `${t.name}(${t.active_hours_start}-${t.active_hours_end}h)`).join(", ")}`);
      return jsonResponse({ processed: 0, reason: `No templates active at hour ${normalizedHour}` });
    }

    console.log(`[ai-follow-up] ✅ ${activeTemplates.length} templates ativos na hora ${normalizedHour}: ${activeTemplates.map((t: any) => t.name).join(", ")}`);

    // Find minimum delay to filter conversations efficiently
    const minDelay = Math.min(...activeTemplates.map((t: any) => t.delay_hours));
    const cutoffTime = new Date(now.getTime() - minDelay * 60 * 60 * 1000).toISOString();

    // Get niche IDs from active templates
    const nicheIds = [...new Set(activeTemplates.map((t: any) => t.niche_id).filter(Boolean))];

    if (!nicheIds.length) {
      console.log("[ai-follow-up] ❌ Nenhum nicho configurado nos templates ativos");
      return jsonResponse({ processed: 0, reason: "No niches in templates" });
    }

    // Collect funnel stages from templates (including 'all')
    const templateStages = [...new Set(activeTemplates.map((t: any) => t.funnel_stage || 'all'))];
    const hasAllStage = templateStages.includes('all');

    console.log(`[ai-follow-up] 🎯 Nichos: ${nicheIds.map((id: string) => id.slice(0,8)).join(", ")} | Etapas dos templates: ${templateStages.join(", ")} | Cutoff: ${cutoffTime}`);

    // Build query - filter by funnel stages that templates actually target
    let query = supabase
      .from("conversations")
      .select("id, contact_name, contact_phone, niche_id, status, updated_at, tags, ad_title, funnel_stage")
      .neq("status", "resolved")
      .in("niche_id", nicheIds)
      .lt("updated_at", cutoffTime)
      .order("updated_at", { ascending: true })
      .limit(50);

    // If no template targets 'all', filter conversations to only matching funnel stages
    if (!hasAllStage) {
      const specificStages = templateStages.filter((s: string) => s !== 'all');
      query = query.in("funnel_stage", specificStages);
      console.log(`[ai-follow-up] 🔍 Filtrando conversas pelas etapas: ${specificStages.join(", ")}`);
    }

    const { data: conversations, error: convError } = await query;

    if (convError) {
      console.error(`[ai-follow-up] ❌ Erro ao buscar conversas: ${convError.message}`);
      return jsonResponse({ error: convError.message }, 500);
    }

    if (!conversations?.length) {
      console.log(`[ai-follow-up] ❌ Nenhuma conversa elegível (cutoff: ${cutoffTime}, nichos: ${nicheIds.length}, etapas: ${templateStages.join(",")})`);
      return jsonResponse({ processed: 0, reason: "No eligible conversations" });
    }

    console.log(`[ai-follow-up] 📊 ${conversations.length} conversas elegíveis encontradas. Distribuição por etapa: ${Object.entries(conversations.reduce((acc: any, c: any) => { acc[c.funnel_stage] = (acc[c.funnel_stage] || 0) + 1; return acc; }, {})).map(([k, v]) => `${k}=${v}`).join(", ")}`);

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
    const skippedReasons: Record<string, number> = {};

    function trackSkip(reason: string) {
      skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
    }

    for (const conv of conversations) {
      // Get recent messages for this conversation
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("sender_type, created_at, content, message_type, media_url")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!lastMessages?.length) {
        trackSkip("sem_mensagens");
        continue;
      }

      const lastMsg = lastMessages[0];
      if (lastMsg.sender_type === "customer") {
        trackSkip("ultima_msg_do_cliente");
        continue;
      }

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
      if (!nicheTemplates.length) {
        trackSkip("sem_template_pro_nicho");
        continue;
      }

      let sentForConv = false;

      for (const template of nicheTemplates) {
        if (sentForConv) break;

        // Check funnel stage match
        const templateStage = template.funnel_stage || 'all';
        const convStage = conv.funnel_stage || 'etapa_1';
        if (templateStage !== 'all' && templateStage !== convStage) {
          trackSkip(`etapa_incompativel(${convStage}!=${templateStage})`);
          continue;
        }

        // Check delay
        if (hoursSinceLastMsg < template.delay_hours) {
          trackSkip(`delay_insuficiente(${Math.round(hoursSinceLastMsg)}h<${template.delay_hours}h)`);
          continue;
        }

        // Check attempts
        const templateExecs = (existingExecs || []).filter((e: any) => e.template_id === template.id);
        const attemptsDone = templateExecs.length;
        if (attemptsDone >= template.max_attempts) {
          trackSkip(`max_tentativas(${attemptsDone}/${template.max_attempts})`);
          continue;
        }

        // Check pending
        if (templateExecs.some((e: any) => e.status === "pending")) {
          trackSkip("execucao_pendente");
          continue;
        }

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
            trackSkip("cliente_respondeu");
            continue;
          }
        }

        console.log(`[ai-follow-up] 🚀 Gerando follow-up para ${conv.contact_name} (etapa: ${funnelStage.label}, template: ${template.name}, tentativa: ${attemptsDone + 1}/${template.max_attempts}, horas sem resposta: ${Math.round(hoursSinceLastMsg)}h)`);

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
          const errText = await aiResponse.text();
          console.error(`[ai-follow-up] ❌ Erro na IA para ${conv.contact_name}: HTTP ${aiResponse.status} - ${errText}`);
          trackSkip(`erro_ia(${aiResponse.status})`);
          continue;
        }

        const aiResult = await aiResponse.json();
        const followUpMessage = aiResult.choices?.[0]?.message?.content?.trim();
        if (!followUpMessage) {
          console.error(`[ai-follow-up] ❌ IA retornou mensagem vazia para ${conv.contact_name}`);
          trackSkip("ia_msg_vazia");
          continue;
        }

        console.log(`[ai-follow-up] 💬 Mensagem gerada para ${conv.contact_name}: "${followUpMessage.substring(0, 80)}..."`);

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

        console.log(`[ai-follow-up] 📤 Enviando via ${sendFunction} para ${conv.contact_name} (${conv.contact_phone})`);

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
          console.log(`[ai-follow-up] ✅ Enviado para ${conv.contact_name} (template: ${template.name}, tentativa: ${attemptsDone + 1}, funil: ${funnelStage.label})`);
        } else {
          const errText = await sendResp.text();
          console.error(`[ai-follow-up] ❌ Falha ao enviar para ${conv.contact_name}: ${errText}`);
          trackSkip(`erro_envio(${sendResp.status})`);
        }
      }
    }

    // Log summary of skipped reasons
    const skipSummary = Object.entries(skippedReasons).map(([reason, count]) => `${reason}: ${count}`).join(" | ");
    console.log(`[ai-follow-up] 📊 Resumo: ${totalSent} enviados, ${conversations.length} processadas. Motivos de skip: ${skipSummary || "nenhum"}`);

    return jsonResponse({ processed: totalSent, skippedReasons });
  } catch (error) {
    console.error("[ai-follow-up] ❌ Erro fatal:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
