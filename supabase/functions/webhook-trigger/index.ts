import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", provider: "webhook-trigger" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const phone = (body.telefone || body.phone) as string | undefined;
  const name = (body.nome || body.name) as string | undefined;
  const status = (body.status_envio || body.status) as string | undefined;

  // Helper to log and respond
  const logAndRespond = async (
    statusCode: number,
    responseBody: Record<string, unknown>,
    logData: Partial<{
      status_key: string;
      phone: string;
      contact_name: string;
      mapping_found: boolean;
      flow_id: string | null;
      conversation_id: string | null;
      result: unknown;
      error: string | null;
      success: boolean;
    }>
  ) => {
    try {
      await supabase.from("webhook_logs").insert({
        status_key: logData.status_key || status || "",
        phone: logData.phone || phone?.replace(/\D/g, "") || "",
        contact_name: logData.contact_name || name || "",
        payload: body,
        mapping_found: logData.mapping_found ?? false,
        flow_id: logData.flow_id || null,
        conversation_id: logData.conversation_id || null,
        result: logData.result || responseBody,
        error: logData.error || null,
        success: logData.success ?? false,
      });
    } catch (e) {
      console.error("Failed to write webhook log:", e);
    }
    return new Response(JSON.stringify(responseBody), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    if (!phone || !status) {
      return await logAndRespond(400, { error: "telefone and status_envio are required" }, {
        error: "telefone and status_envio are required",
      });
    }

    const metadata = {
      nome: name || null,
      telefone: phone || null,
      produto: body.produto || null,
      codigo_rastreamento: body.codigo_rastreamento || null,
      valor: body.valor || null,
      cidade: body.cidade || null,
      departamento: body.departamento || null,
      pais: body.pais || null,
      cedula: body.cedula || null,
      email: body.email || null,
      pedido_id: body.id || null,
    };

    // 1. Find the flow mapping for this status
    const { data: mapping, error: mapErr } = await supabase
      .from("webhook_flow_mappings")
      .select("id, flow_id, is_active, label")
      .eq("status_key", status)
      .maybeSingle();

    if (mapErr) {
      console.error("Error finding mapping:", mapErr);
      return await logAndRespond(500, { error: "Error finding flow mapping" }, {
        status_key: status,
        error: `DB error: ${mapErr.message}`,
      });
    }

    if (!mapping) {
      return await logAndRespond(404, { error: `No mapping found for status "${status}"`, received: body }, {
        status_key: status,
        error: `No mapping found for status "${status}"`,
      });
    }

    if (!mapping.is_active || !mapping.flow_id) {
      return await logAndRespond(200, {
        message: `Mapping "${mapping.label || status}" is inactive or has no flow assigned`,
        skipped: true,
      }, {
        status_key: status,
        mapping_found: true,
        flow_id: mapping.flow_id,
        error: "Mapping inactive or no flow assigned",
      });
    }

    // 2. Normalize phone
    const normalizedPhone = (phone as string).replace(/\D/g, "");
    const contactName = name || normalizedPhone;

    // 2.5 Get ALL active Z-API connections
    const { data: allZapiConnections } = await supabase
      .from("connection_configs")
      .select("id")
      .eq("connection_id", "zapi")
      .eq("is_connected", true)
      .order("created_at");

    const zapiIds = (allZapiConnections || []).map((c: { id: string }) => c.id);

    if (zapiIds.length === 0) {
      return await logAndRespond(500, { error: "No active Z-API connections found" }, {
        status_key: status,
        mapping_found: true,
        flow_id: mapping.flow_id,
        error: "No active Z-API connections found",
      });
    }

    // 3. Find or create conversation with Z-API load balancing
    let conversationId: string;
    let connectionConfigId: string;

    // 3a. Check if this phone already has a conversation in ANY Z-API connection
    const { data: existingZapi } = await supabase
      .from("conversations")
      .select("id, connection_config_id")
      .eq("contact_phone", normalizedPhone)
      .in("connection_config_id", zapiIds)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingZapi) {
      // Lead already exists in a Z-API connection — reuse it
      conversationId = existingZapi.id;
      connectionConfigId = existingZapi.connection_config_id!;
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString(), status: "active" })
        .eq("id", conversationId);
      console.log(`Reusing existing conversation ${conversationId} on connection ${connectionConfigId}`);
    } else {
      // 3b. True round-robin: find which connection was used last, pick the next one
      const { data: lastLog } = await supabase
        .from("webhook_logs")
        .select("conversation_id")
        .eq("success", true)
        .not("conversation_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let lastUsedConnectionId: string | null = null;
      if (lastLog?.conversation_id) {
        const { data: lastConv } = await supabase
          .from("conversations")
          .select("connection_config_id")
          .eq("id", lastLog.conversation_id)
          .maybeSingle();
        lastUsedConnectionId = lastConv?.connection_config_id || null;
      }

      // Find the index of the last used connection and pick the next one
      const lastIdx = lastUsedConnectionId ? zapiIds.indexOf(lastUsedConnectionId) : -1;
      const nextIdx = (lastIdx + 1) % zapiIds.length;
      connectionConfigId = zapiIds[nextIdx];
      console.log(`Round-robin: last used=${lastUsedConnectionId}, picking index ${nextIdx} -> ${connectionConfigId}. All: ${JSON.stringify(zapiIds)}`);

      // Always create a NEW conversation for Z-API — never touch orphan/official API conversations
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          contact_name: contactName,
          contact_phone: normalizedPhone,
          status: "new",
          tags: [],
          connection_config_id: connectionConfigId,
        })
        .select("id")
        .single();

      if (convErr) {
        console.error("Error creating conversation:", convErr);
        return await logAndRespond(500, { error: "Failed to create conversation" }, {
          status_key: status,
          mapping_found: true,
          flow_id: mapping.flow_id,
          error: `Failed to create conversation: ${convErr.message}`,
        });
      }
      conversationId = newConv.id;
    }

    // 4. Execute the mapped flow
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const flowResponse = await fetch(`${supabaseUrl}/functions/v1/execute-flow`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        flowId: mapping.flow_id,
        conversationId,
        senderLabel: "webhook",
        metadata,
      }),
    });

    const flowResult = await flowResponse.json();
    console.log(`Webhook trigger: status="${status}", phone="${normalizedPhone}", flow="${mapping.flow_id}", result:`, flowResult);

    const responseBody = {
      success: true,
      conversationId,
      conversationConnectionConfigId: connectionConfigId,
      flowId: mapping.flow_id,
      statusKey: status,
      flowResult,
    };

    return await logAndRespond(200, responseBody, {
      status_key: status,
      phone: normalizedPhone,
      contact_name: contactName,
      mapping_found: true,
      flow_id: mapping.flow_id,
      conversation_id: conversationId,
      result: flowResult,
      success: true,
    });
  } catch (err) {
    console.error("Webhook trigger error:", err);
    return await logAndRespond(500, { error: "Internal server error", details: String(err) }, {
      status_key: status || "",
      error: String(err),
    });
  }
});
