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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Fetch up to 20 pending replies whose delay has elapsed
  const { data: pending, error: fetchError } = await supabase
    .from("pending_ai_replies")
    .select("id, conversation_id")
    .is("processed_at", null)
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (fetchError) {
    console.error("[ai-auto-reply-cron] Fetch error:", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[ai-auto-reply-cron] Processing ${pending.length} pending replies`);

  // 2. Mark all as processed immediately (prevents double processing)
  const ids = pending.map((p) => p.id);
  await supabase
    .from("pending_ai_replies")
    .update({ processed_at: new Date().toISOString() })
    .in("id", ids);

  // 3. Call ai-auto-reply with mode=process for each, in parallel
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const results = await Promise.allSettled(
    pending.map(async (p) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-auto-reply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: p.conversation_id,
          mode: "process",
        }),
      });
      const body = await res.json();
      return { conversationId: p.conversation_id, status: res.status, body };
    })
  );

  const summary = results.map((r, i) => ({
    conversationId: pending[i].conversation_id,
    result: r.status === "fulfilled" ? r.value : { error: (r as PromiseRejectedResult).reason?.message },
  }));

  console.log("[ai-auto-reply-cron] Results:", JSON.stringify(summary));

  return new Response(JSON.stringify({ processed: pending.length, results: summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
