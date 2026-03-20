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
    const { configId } = await req.json();

    if (!configId) {
      return new Response(
        JSON.stringify({ error: "configId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conn, error } = await supabase
      .from("connection_configs")
      .select("*")
      .eq("id", configId)
      .single();

    if (error || !conn) {
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = conn.config as Record<string, string>;
    let status = "unknown";
    let details: Record<string, unknown> = {};

    if (conn.connection_id === "whatsapp") {
      const token = config.access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneId = config.phone_number_id;

      if (token && phoneId) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}?fields=verified_name,quality_rating,display_phone_number,name_status&access_token=${token}`
          );
          const data = await res.json();
          if (res.ok && !data.error) {
            status = "active";
            details = {
              verified_name: data.verified_name,
              quality_rating: data.quality_rating,
              phone: data.display_phone_number,
              name_status: data.name_status,
            };
          } else {
            status = "error";
            details = { error: data.error?.message || "API returned error" };
          }
        } catch (e) {
          status = "error";
          details = { error: String(e) };
        }
      } else {
        status = "error";
        details = { error: "Missing phone_number_id or access_token" };
      }
    } else if (conn.connection_id === "zapi") {
      const instanceId = config.instance_id;
      const token = config.token || Deno.env.get("ZAPI_TOKEN");
      const clientToken = config.client_token || Deno.env.get("ZAPI_CLIENT_TOKEN");

      if (instanceId && token) {
        try {
          const headers: Record<string, string> = {};
          if (clientToken) headers["Client-Token"] = clientToken;

          const res = await fetch(
            `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
            { headers }
          );
          const data = await res.json();
          if (data.connected === true) {
            status = "active";
            details = { phone: data.smartPhoneConnected, session: data.session };
          } else {
            status = "error";
            details = { error: data.error || data.message || "Disconnected" };
          }
        } catch (e) {
          status = "error";
          details = { error: String(e) };
        }
      } else {
        status = "error";
        details = { error: "Missing instance_id or token" };
      }
    }

    // Update status in DB
    await supabase
      .from("connection_configs")
      .update({ status, last_checked_at: new Date().toISOString() })
      .eq("id", configId);

    return new Response(
      JSON.stringify({ status, details }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-connection-status error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
