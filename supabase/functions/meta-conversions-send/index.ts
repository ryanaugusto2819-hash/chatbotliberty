import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function hashSha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface ConversionEventPayload {
  conversation_id?: string;
  lead_id?: string;
  order_id?: string;
  event_name: string;
  phone: string;
  ctwa_clid?: string;
  value?: number;
  currency?: string;
  event_id?: string;
}

interface RetryPayload {
  conversion_event_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const mode = body.mode || "send"; // "send" | "retry" | "batch_retry"

    if (mode === "retry") {
      return await handleRetry(supabase, body as RetryPayload);
    }

    if (mode === "batch_retry") {
      return await handleBatchRetry(supabase);
    }

    // mode === "send"
    return await handleSend(supabase, body as ConversionEventPayload);
  } catch (err) {
    console.error("[meta-conversions-send] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getCapiConfig(supabase: any) {
  const { data, error } = await supabase
    .from("meta_capi_config")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Meta CAPI configuration not found or inactive");
  }

  if (!data.dataset_id || !data.access_token) {
    throw new Error("Meta CAPI configuration incomplete: missing dataset_id or access_token");
  }

  return data;
}

async function handleSend(supabase: any, payload: ConversionEventPayload) {
  const {
    conversation_id,
    lead_id,
    order_id,
    event_name,
    phone,
    ctwa_clid,
    value,
    currency = "BRL",
  } = payload;

  if (!event_name || !phone) {
    return new Response(
      JSON.stringify({ error: "event_name and phone are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate unique event_id for idempotency
  const eventId = payload.event_id || `${event_name}_${normalizePhone(phone)}_${Date.now()}`;

  // Check for duplicate
  const { data: existingEvent } = await supabase
    .from("conversion_events")
    .select("id, status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent && existingEvent.status === "sent") {
    return new Response(
      JSON.stringify({ message: "Event already sent", event_id: eventId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const config = await getCapiConfig(supabase);

  // Build Meta CAPI payload
  const eventTime = Math.floor(Date.now() / 1000);
  const normalizedPhone = normalizePhone(phone);

  const metaPayload: any = {
    data: [
      {
        event_name,
        event_time: eventTime,
        event_id: eventId,
        action_source: "business_messaging",
        messaging_channel: "whatsapp",
        user_data: {
          ph: [normalizedPhone],
        },
        custom_data: {} as any,
      },
    ],
  };

  if (ctwa_clid) {
    metaPayload.data[0].user_data.ctwa_clid = ctwa_clid;
  }

  if (value !== undefined && value !== null) {
    metaPayload.data[0].custom_data.value = value;
    metaPayload.data[0].custom_data.currency = currency;
  }

  if (order_id) {
    metaPayload.data[0].custom_data.order_id = order_id;
  }

  // Remove empty custom_data
  if (Object.keys(metaPayload.data[0].custom_data).length === 0) {
    delete metaPayload.data[0].custom_data;
  }

  // Create or update event record
  const eventRecord: any = {
    event_id: eventId,
    conversation_id: conversation_id || null,
    lead_id: lead_id || null,
    order_id: order_id || null,
    event_name,
    phone: normalizedPhone,
    ctwa_clid: ctwa_clid || null,
    value: value || null,
    currency,
    status: "pending",
    payload_json: metaPayload,
  };

  let eventDbId: string;

  if (existingEvent) {
    eventDbId = existingEvent.id;
    await supabase
      .from("conversion_events")
      .update({ ...eventRecord, retry_count: existingEvent.retry_count || 0, updated_at: new Date().toISOString() })
      .eq("id", existingEvent.id);
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("conversion_events")
      .insert(eventRecord)
      .select("id")
      .single();

    if (insertErr) {
      console.error("[meta-conversions-send] Insert error:", insertErr);
      throw new Error(`Failed to create event record: ${insertErr.message}`);
    }
    eventDbId = inserted.id;
  }

  // Send to Meta
  const url = `${config.graph_base_url}/${config.api_version}/${config.dataset_id}/events?access_token=${config.access_token}`;

  try {
    console.log(`[meta-conversions-send] Sending ${event_name} to Meta for phone ${normalizedPhone}`);

    const metaRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaPayload),
    });

    const responseBody = await metaRes.json();

    if (metaRes.ok) {
      await supabase
        .from("conversion_events")
        .update({
          status: "sent",
          response_json: responseBody,
          sent_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventDbId);

      console.log(`[meta-conversions-send] ✅ ${event_name} sent successfully`);

      return new Response(
        JSON.stringify({ success: true, event_id: eventId, meta_response: responseBody }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMsg = JSON.stringify(responseBody).slice(0, 1000);
      console.error(`[meta-conversions-send] ❌ Meta returned ${metaRes.status}: ${errorMsg}`);

      await supabase
        .from("conversion_events")
        .update({
          status: "failed",
          response_json: responseBody,
          error_message: errorMsg,
          retry_count: (existingEvent?.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventDbId);

      return new Response(
        JSON.stringify({ error: "Meta API error", details: responseBody, event_id: eventId }),
        { status: metaRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (fetchErr) {
    const errorMsg = fetchErr.message || "Network error";
    console.error(`[meta-conversions-send] Network error: ${errorMsg}`);

    await supabase
      .from("conversion_events")
      .update({
        status: "failed",
        error_message: errorMsg,
        retry_count: (existingEvent?.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventDbId);

    throw fetchErr;
  }
}

async function handleRetry(supabase: any, payload: RetryPayload) {
  const { conversion_event_id } = payload;

  if (!conversion_event_id) {
    return new Response(
      JSON.stringify({ error: "conversion_event_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: event, error } = await supabase
    .from("conversion_events")
    .select("*")
    .eq("id", conversion_event_id)
    .single();

  if (error || !event) {
    return new Response(
      JSON.stringify({ error: "Event not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Re-send using stored payload
  const config = await getCapiConfig(supabase);
  const url = `${config.graph_base_url}/${config.api_version}/${config.dataset_id}/events?access_token=${config.access_token}`;

  // Update event_time to now for retry
  const retryPayload = { ...event.payload_json };
  if (retryPayload.data?.[0]) {
    retryPayload.data[0].event_time = Math.floor(Date.now() / 1000);
  }

  try {
    const metaRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(retryPayload),
    });

    const responseBody = await metaRes.json();

    if (metaRes.ok) {
      await supabase
        .from("conversion_events")
        .update({
          status: "sent",
          response_json: responseBody,
          sent_at: new Date().toISOString(),
          error_message: null,
          payload_json: retryPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversion_event_id);

      return new Response(
        JSON.stringify({ success: true, meta_response: responseBody }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMsg = JSON.stringify(responseBody).slice(0, 1000);
      await supabase
        .from("conversion_events")
        .update({
          status: "failed",
          response_json: responseBody,
          error_message: errorMsg,
          retry_count: (event.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversion_event_id);

      return new Response(
        JSON.stringify({ error: "Meta API error on retry", details: responseBody }),
        { status: metaRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (fetchErr) {
    await supabase
      .from("conversion_events")
      .update({
        status: "failed",
        error_message: fetchErr.message || "Network error on retry",
        retry_count: (event.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversion_event_id);

    throw fetchErr;
  }
}

async function handleBatchRetry(supabase: any) {
  // Find all failed events with retry_count < 5
  const { data: failedEvents, error } = await supabase
    .from("conversion_events")
    .select("id")
    .eq("status", "failed")
    .lt("retry_count", 5)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error || !failedEvents?.length) {
    return new Response(
      JSON.stringify({ message: "No events to retry", count: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results = await Promise.allSettled(
    failedEvents.map((e: any) => handleRetry(supabase, { conversion_event_id: e.id }))
  );

  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;

  return new Response(
    JSON.stringify({ message: "Batch retry complete", total: failedEvents.length, succeeded, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
