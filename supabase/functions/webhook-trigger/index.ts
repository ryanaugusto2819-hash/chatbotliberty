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

  try {
    const body = await req.json();
    const { phone, name, status } = body;

    if (!phone || !status) {
      return new Response(
        JSON.stringify({ error: "phone and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find the flow mapping for this status
    const { data: mapping, error: mapErr } = await supabase
      .from("webhook_flow_mappings")
      .select("id, flow_id, is_active, label")
      .eq("status_key", status)
      .maybeSingle();

    if (mapErr) {
      console.error("Error finding mapping:", mapErr);
      return new Response(
        JSON.stringify({ error: "Error finding flow mapping" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mapping) {
      return new Response(
        JSON.stringify({ error: `No mapping found for status "${status}"`, received: body }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mapping.is_active || !mapping.flow_id) {
      return new Response(
        JSON.stringify({ message: `Mapping "${mapping.label || status}" is inactive or has no flow assigned`, skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Normalize phone
    const normalizedPhone = phone.replace(/\D/g, "");
    const contactName = name || normalizedPhone;

    // 3. Find or create conversation
    let conversationId: string;

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_phone", normalizedPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      conversationId = existing.id;
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString(), status: "active" })
        .eq("id", conversationId);
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          contact_name: contactName,
          contact_phone: normalizedPhone,
          status: "new",
          tags: [],
        })
        .select("id")
        .single();

      if (convErr) {
        console.error("Error creating conversation:", convErr);
        return new Response(
          JSON.stringify({ error: "Failed to create conversation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      }),
    });

    const flowResult = await flowResponse.json();
    console.log(`Webhook trigger: status="${status}", phone="${normalizedPhone}", flow="${mapping.flow_id}", result:`, flowResult);

    return new Response(
      JSON.stringify({
        success: true,
        conversationId,
        flowId: mapping.flow_id,
        statusKey: status,
        flowResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook trigger error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
