import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function createJsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function uploadWhatsAppMedia(params: {
  accessToken: string;
  mediaUrl: string;
  phoneNumberId: string;
  mediaType: "image" | "audio" | "video";
}) {
  const mediaResponse = await fetch(params.mediaUrl);
  if (!mediaResponse.ok) {
    throw new Error(`Falha ao baixar mídia: ${mediaResponse.status}`);
  }

  const blob = await mediaResponse.blob();
  const sourceContentType = mediaResponse.headers.get("content-type");
  const fallbackContentType =
    params.mediaType === "video"
      ? "video/mp4"
      : params.mediaType === "audio"
        ? "audio/ogg"
        : "image/jpeg";

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append(
    "file",
    new File([blob], `automation-${params.mediaType}`, {
      type: sourceContentType || fallbackContentType,
    })
  );

  const uploadResponse = await fetch(`https://graph.facebook.com/v21.0/${params.phoneNumberId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: formData,
  });

  const uploadResult = await uploadResponse.json();
  if (!uploadResponse.ok || !uploadResult.id) {
    throw new Error(JSON.stringify(uploadResult.error || uploadResult));
  }

  return uploadResult.id as string;
}

async function sendWhatsAppCloudMessage(params: {
  accessToken: string;
  phoneNumberId: string;
  conversationPhone: string;
  nodeType: string;
  config: Record<string, unknown>;
  waPayload: Record<string, unknown>;
}) {
  const directMediaTypes = new Set(["image", "audio", "video"]);
  let payload = params.waPayload;

  if (directMediaTypes.has(params.nodeType)) {
    const mediaUrl = typeof params.config.media_url === "string" ? params.config.media_url : "";
    if (!mediaUrl) {
      throw new Error(`Mídia ausente para nó ${params.nodeType}`);
    }

    const mediaId = await uploadWhatsAppMedia({
      accessToken: params.accessToken,
      mediaUrl,
      phoneNumberId: params.phoneNumberId,
      mediaType: params.nodeType as "image" | "audio" | "video",
    });

    if (params.nodeType === "image") {
      payload = {
        messaging_product: "whatsapp",
        to: params.conversationPhone,
        type: "image",
        image: {
          id: mediaId,
          caption: (params.config.caption as string) || undefined,
        },
      };
    } else if (params.nodeType === "audio") {
      payload = {
        messaging_product: "whatsapp",
        to: params.conversationPhone,
        type: "audio",
        audio: {
          id: mediaId,
        },
      };
    } else if (params.nodeType === "video") {
      payload = {
        messaging_product: "whatsapp",
        to: params.conversationPhone,
        type: "video",
        video: {
          id: mediaId,
          caption: (params.config.caption as string) || undefined,
        },
      };
    }
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { flowId, conversationId } = await req.json();

    if (!flowId || !conversationId) {
      return createJsonResponse({ error: "flowId and conversationId are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conversation } = await supabase
      .from("conversations")
      .select("contact_phone")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return createJsonResponse({ error: "Conversation not found" }, 404);
    }

    const { data: connections } = await supabase
      .from("connection_configs")
      .select("connection_id, config, is_connected")
      .in("connection_id", ["zapi", "whatsapp"])
      .eq("is_connected", true);

    const zapiConnection = connections?.find((c) => c.connection_id === "zapi");
    const waConnection = connections?.find((c) => c.connection_id === "whatsapp");
    const useZapi = !!zapiConnection;

    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiConfigData = zapiConnection?.config as Record<string, unknown> | null;
    const zapiClientToken = (zapiConfigData?.client_token as string) || Deno.env.get("ZAPI_CLIENT_TOKEN") || "";

    const waConfigData = waConnection?.config as Record<string, unknown> | null;
    const phoneNumberId =
      (typeof waConfigData?.phone_number_id === "string" && waConfigData.phone_number_id.trim())
        ? waConfigData.phone_number_id
        : Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (useZapi && (!zapiInstanceId || !zapiToken)) {
      return createJsonResponse({ error: "Z-API not configured" }, 500);
    }

    if (!useZapi && (!phoneNumberId || !accessToken)) {
      return createJsonResponse({ error: "WhatsApp not configured" }, 500);
    }

    let phone = conversation.contact_phone.replace(/\D/g, "");
    // Normalize Brazilian phone numbers (add 9th digit if missing)
    if (phone.startsWith("55") && phone.length === 12) {
      const ddd = phone.substring(2, 4);
      const localNumber = phone.substring(4);
      if (!localNumber.startsWith("9")) {
        phone = `55${ddd}9${localNumber}`;
        console.log(`Normalized phone: ${conversation.contact_phone} -> ${phone}`);
      }
    }

    const { data: nodes } = await supabase
      .from("automation_nodes")
      .select("*")
      .eq("flow_id", flowId)
      .order("sort_order", { ascending: true });

    if (!nodes?.length) {
      return createJsonResponse({ error: "No nodes in flow" }, 400);
    }

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
          to: phone,
          type: "text",
          text: { body: content },
        };
      } else if (node.node_type === "image") {
        waPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "image",
          image: { link: config.media_url, caption: config.caption || undefined },
        };
      } else if (node.node_type === "audio") {
        waPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "audio",
          audio: { link: config.media_url },
        };
      } else if (node.node_type === "video") {
        waPayload = {
          messaging_product: "whatsapp",
          to: phone,
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
          waPayload = {
            messaging_product: "whatsapp",
            to: phone,
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
          const buttonText = buttons.length > 0
            ? "\n\n" + buttons.map((b, i) => `${i + 1}. ${b}`).join("\n")
            : "";
          waPayload = {
            messaging_product: "whatsapp",
            to: phone,
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

      let waResponse: Response;
      let waResult: Record<string, unknown>;

      try {
        if (useZapi) {
          let zapiEndpoint: string;
          let zapiBody: Record<string, unknown>;
          const zapiBase = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}`;

          if (node.node_type === "audio") {
            zapiEndpoint = `${zapiBase}/send-ptts`;
            zapiBody = { phone, audio: config.media_url };
          } else if (node.node_type === "image") {
            zapiEndpoint = `${zapiBase}/send-link-image`;
            zapiBody = { phone, imageUrl: config.media_url, caption: (config.caption as string) || "" };
          } else if (node.node_type === "video") {
            zapiEndpoint = `${zapiBase}/send-link-video`;
            zapiBody = { phone, videoUrl: config.media_url, caption: (config.caption as string) || "" };
          } else {
            const textBody = (waPayload as Record<string, unknown>).text as Record<string, unknown> | undefined;
            const interactiveBody = (waPayload as Record<string, unknown>).interactive as Record<string, unknown> | undefined;
            let textContent = "";

            if (textBody) {
              textContent = (textBody.body as string) || "";
            } else if (interactiveBody) {
              const body = ((interactiveBody.body as Record<string, unknown>)?.text as string) || "";
              const action = interactiveBody.action as Record<string, unknown>;
              const buttons = (action?.buttons as Array<Record<string, unknown>>) || [];
              const btnText = buttons
                .map((b, i) => `${i + 1}. ${(b.reply as Record<string, unknown>)?.title || ""}`)
                .join("\n");
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
          waResponse = await sendWhatsAppCloudMessage({
            accessToken,
            phoneNumberId,
            conversationPhone: conversation.contact_phone,
            nodeType: node.node_type,
            config,
            waPayload,
          });
        }

        waResult = await waResponse.json();
      } catch (error) {
        console.error("WhatsApp send exception:", error);
        waResponse = new Response(null, { status: 500 });
        waResult = {
          error: error instanceof Error ? error.message : "Unknown send error",
        };
      }

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
        break;
      }

      let msgContent = "";
      let msgMediaUrl: string | null = null;
      let normalizedType = "text";

      if (node.node_type === "message") {
        msgContent = (config.content as string) || "";
      } else if (node.node_type === "image") {
        msgContent = (config.caption as string) || "";
        msgMediaUrl = (config.media_url as string) || null;
        normalizedType = "image";
      } else if (node.node_type === "audio") {
        msgMediaUrl = (config.media_url as string) || null;
        normalizedType = "audio";
      } else if (node.node_type === "video") {
        msgContent = (config.caption as string) || "";
        msgMediaUrl = (config.media_url as string) || null;
        normalizedType = "video";
      } else if (node.node_type === "quick_reply") {
        const qrContent = (config.content as string) || "";
        const qrButtons = (config.buttons as string[]) || [];
        msgContent = qrButtons.length > 0
          ? qrContent + "\n\n" + qrButtons.map((b, i) => `${i + 1}. ${b}`).join("\n")
          : qrContent;
      }

      const { error: messageInsertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        content: msgContent,
        sender_type: "agent",
        message_type: normalizedType,
        media_url: msgMediaUrl,
        status: "sent",
      });

      if (messageInsertError) {
        console.error("Message insert error:", messageInsertError);
      }

      if (executionId) {
        await supabase.from("flow_step_logs").insert({
          execution_id: executionId,
          node_id: node.id,
          node_type: node.node_type,
          node_label: node.label || node.node_type,
          sort_order: node.sort_order,
          status: "completed",
          error_message: messageInsertError ? `message_insert: ${messageInsertError.message}` : null,
        });
      }
      completedCount++;
      results.push({ nodeId: node.id, status: "sent" });
    }

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

    const { data: currentFlow } = await supabase
      .from("automation_flows")
      .select("trigger_count")
      .eq("id", flowId)
      .single();

    await supabase
      .from("automation_flows")
      .update({ trigger_count: (currentFlow?.trigger_count || 0) + 1 })
      .eq("id", flowId);

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return createJsonResponse({ success: true, executionId, results }, 200);
  } catch (error) {
    console.error("Execute flow error:", error);
    return createJsonResponse({ error: "Internal server error" }, 500);
  }
});
