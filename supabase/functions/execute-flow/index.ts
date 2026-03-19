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

    // Check which provider is connected
    const { data: connections } = await supabase
      .from("connection_configs")
      .select("connection_id, config, is_connected")
      .in("connection_id", ["zapi", "whatsapp"])
      .eq("is_connected", true);

    const zapiConnection = connections?.find((c) => c.connection_id === "zapi");
    const waConnection = connections?.find((c) => c.connection_id === "whatsapp");
    const useZapi = !!zapiConnection;

    // Z-API credentials
    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiConfigData = zapiConnection?.config as Record<string, unknown> | null;
    const zapiClientToken = (zapiConfigData?.client_token as string) || Deno.env.get("ZAPI_CLIENT_TOKEN") || "";

    // WhatsApp Cloud API credentials
    const waConfigData = waConnection?.config as Record<string, unknown> | null;
    const phoneNumberId =
      (typeof waConfigData?.phone_number_id === "string" && waConfigData.phone_number_id.trim())
        ? waConfigData.phone_number_id
        : Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (useZapi && (!zapiInstanceId || !zapiToken)) {
      return new Response(
        JSON.stringify({ error: "Z-API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!useZapi && (!phoneNumberId || !accessToken)) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = conversation.contact_phone.replace(/\D/g, "");

    // Get nodes sorted by sort_order
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

    // Create flow execution record
    const { data: execution } = await supabase
      .from("flow_executions")
      .insert({
        flow_id: flowId,
        conversation_id: conversationId,
        status: "running",
        total_nodes: nodes.length,
        completed_nodes: 0,
      })
      .select("id")
      .single();

    const executionId = execution?.id;

    const results: { nodeId: string; status: string }[] = [];
    let completedCount = 0;
    let failed = false;

    for (const node of nodes) {
      const config = node.config as Record<string, unknown>;

      if (node.node_type === "trigger") {
        // Log trigger step
        if (executionId) {
          await supabase.from("flow_step_logs").insert({
            execution_id: executionId,
            node_id: node.id,
            node_type: node.node_type,
            node_label: node.label || "Gatilho",
            sort_order: node.sort_order,
            status: "completed",
          });
        }
        completedCount++;
        results.push({ nodeId: node.id, status: "started" });
        continue;
      }

    if (node.node_type === "delay") {
        const delayValue = (config.delay_value as number) || (config.delay_seconds as number) || 5;
        const delayUnit = (config.delay_unit as string) || "seconds";
        const seconds = delayUnit === "minutes" ? delayValue * 60
          : delayUnit === "hours" ? delayValue * 3600
          : delayValue;
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        if (executionId) {
          await supabase.from("flow_step_logs").insert({
            execution_id: executionId,
            node_id: node.id,
            node_type: node.node_type,
            node_label: node.label || `Esperar ${seconds}s`,
            sort_order: node.sort_order,
            status: "completed",
          });
        }
        completedCount++;
        results.push({ nodeId: node.id, status: `delayed ${seconds}s` });
        continue;
      }

      // Build WhatsApp message payload
      let waPayload: Record<string, unknown>;

      if (node.node_type === "message") {
        const content = (config.content as string) || "";
        if (!content.trim()) {
          if (executionId) {
            await supabase.from("flow_step_logs").insert({
              execution_id: executionId,
              node_id: node.id,
              node_type: node.node_type,
              node_label: node.label || "Mensagem",
              sort_order: node.sort_order,
              status: "skipped",
              error_message: "Conteúdo vazio",
            });
          }
          results.push({ nodeId: node.id, status: "skipped_empty" });
          continue;
        }
        waPayload = {
          messaging_product: "whatsapp",
          to: conversation.contact_phone,
          type: "text",
          text: { body: content },
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
      } else if (node.node_type === "quick_reply") {
        const content = (config.content as string) || "";
        const buttons = (config.buttons as string[]) || [];
        if (!content.trim()) {
          if (executionId) {
            await supabase.from("flow_step_logs").insert({
              execution_id: executionId,
              node_id: node.id,
              node_type: node.node_type,
              node_label: node.label || "Resposta Rápida",
              sort_order: node.sort_order,
              status: "skipped",
              error_message: "Conteúdo vazio",
            });
          }
          results.push({ nodeId: node.id, status: "skipped_empty" });
          continue;
        }
        if (buttons.length > 0 && buttons.length <= 3) {
          // Use WhatsApp interactive buttons (max 3)
          waPayload = {
            messaging_product: "whatsapp",
            to: conversation.contact_phone,
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: content },
              action: {
                buttons: buttons.map((btn, idx) => ({
                  type: "reply",
                  reply: { id: `btn_${idx}`, title: btn.slice(0, 20) },
                })),
              },
            },
          };
        } else {
          // Fallback to plain text if no buttons or more than 3
          const buttonText = buttons.length > 0
            ? "\n\n" + buttons.map((b, i) => `${i + 1}. ${b}`).join("\n")
            : "";
          waPayload = {
            messaging_product: "whatsapp",
            to: conversation.contact_phone,
            type: "text",
            text: { body: content + buttonText },
          };
        }
      } else {
        if (executionId) {
          await supabase.from("flow_step_logs").insert({
            execution_id: executionId,
            node_id: node.id,
            node_type: node.node_type,
            node_label: node.label || node.node_type,
            sort_order: node.sort_order,
            status: "skipped",
          });
        }
        results.push({ nodeId: node.id, status: "skipped" });
        continue;
      }

      // Send via the appropriate provider
      let waResponse: Response;

      if (useZapi) {
        // Determine Z-API endpoint based on node type
        let zapiEndpoint: string;
        let zapiBody: Record<string, unknown>;
        const zapiBase = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}`;

        if (node.node_type === "audio") {
          // Send as PTT (voice message) via Z-API
          zapiEndpoint = `${zapiBase}/send-ptts`;
          zapiBody = { phone, audio: config.media_url };
        } else if (node.node_type === "image") {
          zapiEndpoint = `${zapiBase}/send-link-image`;
          zapiBody = { phone, imageUrl: config.media_url, caption: (config.caption as string) || "" };
        } else if (node.node_type === "video") {
          zapiEndpoint = `${zapiBase}/send-link-video`;
          zapiBody = { phone, videoUrl: config.media_url, caption: (config.caption as string) || "" };
        } else {
          // Text, quick_reply fallback -> send-text
          const textBody = (waPayload as Record<string, unknown>).text as Record<string, unknown> | undefined;
          const interactiveBody = (waPayload as Record<string, unknown>).interactive as Record<string, unknown> | undefined;
          let textContent = "";
          if (textBody) {
            textContent = (textBody.body as string) || "";
          } else if (interactiveBody) {
            const body = (interactiveBody.body as Record<string, unknown>)?.text as string || "";
            const action = interactiveBody.action as Record<string, unknown>;
            const buttons = (action?.buttons as Array<Record<string, unknown>>) || [];
            const btnText = buttons.map((b, i) => `${i + 1}. ${(b.reply as Record<string, unknown>)?.title || ""}`).join("\n");
            textContent = body + (btnText ? "\n\n" + btnText : "");
          }
          zapiEndpoint = `${zapiBase}/send-text`;
          zapiBody = { phone, message: textContent };
        }

        waResponse = await fetch(zapiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": zapiClientToken,
          },
          body: JSON.stringify(zapiBody),
        });
      } else {
        // WhatsApp Cloud API
        waResponse = await fetch(
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
      }

      const waResult = await waResponse.json();

      if (!waResponse.ok) {
        console.error("WhatsApp send error:", waResult);
        if (executionId) {
          await supabase.from("flow_step_logs").insert({
            execution_id: executionId,
            node_id: node.id,
            node_type: node.node_type,
            node_label: node.label || node.node_type,
            sort_order: node.sort_order,
            status: "failed",
            error_message: JSON.stringify(waResult.error || waResult).slice(0, 500),
          });
          // Mark execution as failed at this node
          await supabase
            .from("flow_executions")
            .update({
              status: "failed",
              failed_at_node_id: node.id,
              completed_nodes: completedCount,
              completed_at: new Date().toISOString(),
            })
            .eq("id", executionId);
        }
        failed = true;
        results.push({ nodeId: node.id, status: "error" });
        break; // Stop execution on failure
      }

      // Save message to DB
      let msgContent = "";
      let msgMediaUrl: string | null = null;
      let normalizedType = "text";

      if (node.node_type === "message") {
        msgContent = (config.content as string) || "";
        normalizedType = "text";
      } else if (node.node_type === "image") {
        msgContent = (config.caption as string) || "";
        msgMediaUrl = (config.media_url as string) || null;
        normalizedType = "image";
      } else if (node.node_type === "audio") {
        msgContent = "";
        msgMediaUrl = (config.media_url as string) || null;
        normalizedType = "audio";
      } else if (node.node_type === "video") {
        msgContent = (config.caption as string) || "";
        msgMediaUrl = (config.media_url as string) || null;
        normalizedType = "text";
      } else if (node.node_type === "quick_reply") {
        const qrContent = (config.content as string) || "";
        const qrButtons = (config.buttons as string[]) || [];
        msgContent = qrButtons.length > 0
          ? qrContent + "\n\n" + qrButtons.map((b, i) => `${i + 1}. ${b}`).join("\n")
          : qrContent;
        normalizedType = "text";
      }

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        content: msgContent,
        sender_type: "agent",
        message_type: normalizedType,
        media_url: msgMediaUrl,
        status: "sent",
      });

      // Log successful step
      if (executionId) {
        await supabase.from("flow_step_logs").insert({
          execution_id: executionId,
          node_id: node.id,
          node_type: node.node_type,
          node_label: node.label || node.node_type,
          sort_order: node.sort_order,
          status: "completed",
        });
      }
      completedCount++;
      results.push({ nodeId: node.id, status: "sent" });
    }

    // Mark execution as completed if not already failed
    if (executionId && !failed) {
      await supabase
        .from("flow_executions")
        .update({
          status: "completed",
          completed_nodes: completedCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", executionId);
    }

    // Update trigger count
    const { data: currentFlow } = await supabase
      .from("automation_flows")
      .select("trigger_count")
      .eq("id", flowId)
      .single();

    await supabase
      .from("automation_flows")
      .update({ trigger_count: (currentFlow?.trigger_count || 0) + 1 })
      .eq("id", flowId);

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ success: true, executionId, results }),
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
