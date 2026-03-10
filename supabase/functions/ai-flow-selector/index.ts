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

    // Check if flow selector is enabled
    const { data: config } = await supabase
      .from("connection_configs")
      .select("config")
      .eq("connection_id", "ai-flow-selector")
      .maybeSingle();

    const selectorConfig = config?.config as Record<string, unknown> | null;
    if (!selectorConfig?.enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Flow selector disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active flows
    const { data: flows } = await supabase
      .from("automation_flows")
      .select("id, name, description")
      .eq("is_active", true);

    if (!flows?.length) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No active flows" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch last 5 messages for context
    const { data: messages } = await supabase
      .from("messages")
      .select("content, sender_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No messages" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build flow list for AI
    const flowList = flows.map((f, i) => `${i + 1}. "${f.name}" - ${f.description || "Sem descrição"}`).join("\n");

    const recentMessages = messages
      .reverse()
      .map((m) => `${m.sender_type === "customer" ? "Cliente" : "Agente"}: ${m.content}`)
      .join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AI to select flow using tool calling for structured output
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
            content: `Você é um selecionador inteligente de fluxos de automação para atendimento via WhatsApp.
Analise a mensagem mais recente do cliente e o contexto da conversa, e decida qual fluxo de automação deve ser disparado.
Se nenhum fluxo se encaixar no contexto da mensagem, retorne null como flow_id.
Seja criterioso: só selecione um fluxo se realmente fizer sentido para a mensagem do cliente.`,
          },
          {
            role: "user",
            content: `Fluxos disponíveis:\n${flowList}\n\nConversa recente:\n${recentMessages}\n\nQual fluxo deve ser disparado?`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "select_flow",
              description: "Seleciona o fluxo de automação mais adequado para a mensagem do cliente, ou null se nenhum se encaixar.",
              parameters: {
                type: "object",
                properties: {
                  flow_index: {
                    type: ["integer", "null"],
                    description: "Índice do fluxo selecionado (1-based) ou null se nenhum se encaixar",
                  },
                  reason: {
                    type: "string",
                    description: "Breve justificativa da escolha",
                  },
                },
                required: ["flow_index", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "select_flow" } },
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

    // Extract tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.log("No tool call in AI response");
      return new Response(
        JSON.stringify({ skipped: true, reason: "AI did not select a flow" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let selection: { flow_index: number | null; reason: string };
    try {
      selection = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse AI tool call:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ skipped: true, reason: "Invalid AI response" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI flow selection:", JSON.stringify(selection));

    if (selection.flow_index === null || selection.flow_index < 1 || selection.flow_index > flows.length) {
      return new Response(
        JSON.stringify({ skipped: true, reason: selection.reason || "No matching flow" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedFlow = flows[selection.flow_index - 1];
    console.log(`Executing flow "${selectedFlow.name}" (${selectedFlow.id}). Reason: ${selection.reason}`);

    // Execute the selected flow
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const execResponse = await fetch(`${supabaseUrl}/functions/v1/execute-flow`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ flowId: selectedFlow.id, conversationId }),
    });

    const execResult = await execResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        selectedFlow: { id: selectedFlow.id, name: selectedFlow.name },
        reason: selection.reason,
        execution: execResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Flow selector error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
