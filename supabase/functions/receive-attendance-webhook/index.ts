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
    return new Response(
      JSON.stringify({ status: "ok", provider: "receive-attendance-webhook" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
  const cedula = (body.cedula || body.cpf) as string | undefined;
  const billingStage = (body.status_cobranca || body.billing_stage) as string | undefined;
  const billingConnectionName = (body.wpp_cobranca || body.billing_connection) as string | undefined;

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    if (!phone || !billingStage) {
      return new Response(
        JSON.stringify({ error: "telefone and status_cobranca are required" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const normalizedPhone = phone.replace(/\D/g, "");

    // Find conversation by phone number
    const { data: conversations, error: convErr } = await supabase
      .from("conversations")
      .select("id, contact_phone, billing_stage, billing_connection_name, connection_config_id")
      .eq("contact_phone", normalizedPhone)
      .order("updated_at", { ascending: false });

    if (convErr) {
      console.error("Error finding conversations:", convErr);
      return new Response(
        JSON.stringify({ error: "Error finding conversations" }),
        { status: 500, headers: jsonHeaders }
      );
    }

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({
          error: `No conversation found for phone "${normalizedPhone}"`,
          received: body,
        }),
        { status: 404, headers: jsonHeaders }
      );
    }

    // Update ALL conversations for this phone with billing info
    const updateData: Record<string, unknown> = {
      billing_stage: billingStage,
      updated_at: new Date().toISOString(),
    };

    if (billingConnectionName) {
      updateData.billing_connection_name = billingConnectionName;
    }

    const { error: updateErr } = await supabase
      .from("conversations")
      .update(updateData)
      .eq("contact_phone", normalizedPhone);

    if (updateErr) {
      console.error("Error updating conversations:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update conversations" }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const updatedCount = conversations.length;
    console.log(
      `[receive-attendance-webhook] Updated ${updatedCount} conversation(s) for phone ${normalizedPhone}: billing_stage="${billingStage}", billing_connection="${billingConnectionName || "N/A"}"`
    );

    return new Response(
      JSON.stringify({
        success: true,
        updated_conversations: updatedCount,
        phone: normalizedPhone,
        billing_stage: billingStage,
        billing_connection_name: billingConnectionName || null,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error("receive-attendance-webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
