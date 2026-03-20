import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const META_APP_ID = Deno.env.get("META_APP_ID");
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET");

    if (!META_APP_ID || !META_APP_SECRET) {
      return new Response(
        JSON.stringify({ error: "META_APP_ID or META_APP_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: get_app_id — return the public APP_ID to the frontend
    if (action === "get_app_id") {
      return new Response(
        JSON.stringify({ app_id: META_APP_ID }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: exchange_token — exchange short-lived token, get WABA info, store connection
    if (action === "exchange_token") {
      const { accessToken, label } = body;

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "accessToken is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 1. Exchange short-lived token for long-lived token
      const tokenUrl = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${accessToken}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error("Token exchange error:", tokenData.error);
        return new Response(
          JSON.stringify({ error: "Failed to exchange token", details: tokenData.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const longLivedToken = tokenData.access_token;

      // 2. Get shared WABA list using debug_token or business discovery
      // First get the user's business integrations
      const sharedWabasRes = await fetch(
        `${GRAPH_API}/debug_token?input_token=${longLivedToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`
      );
      const debugData = await sharedWabasRes.json();
      console.log("Debug token data:", JSON.stringify(debugData));

      // 3. Get WhatsApp Business Accounts shared with the app
      // Using the user token to list shared WABAs
      const wabaListRes = await fetch(
        `${GRAPH_API}/me/businesses?access_token=${longLivedToken}`
      );
      const businessesData = await wabaListRes.json();
      console.log("Businesses:", JSON.stringify(businessesData));

      let wabaId: string | null = null;
      let phoneNumberId: string | null = null;
      let phoneDisplay: string | null = null;

      // Try to find WABA from the granted scopes / shared assets
      if (debugData?.data?.granular_scopes) {
        for (const scope of debugData.data.granular_scopes) {
          if (scope.scope === "whatsapp_business_management" && scope.target_ids?.length > 0) {
            wabaId = scope.target_ids[0];
            break;
          }
        }
      }

      // If we found a WABA, get phone numbers
      if (wabaId) {
        const phonesRes = await fetch(
          `${GRAPH_API}/${wabaId}/phone_numbers?access_token=${longLivedToken}`
        );
        const phonesData = await phonesRes.json();
        console.log("Phone numbers:", JSON.stringify(phonesData));

        if (phonesData.data && phonesData.data.length > 0) {
          phoneNumberId = phonesData.data[0].id;
          phoneDisplay = phonesData.data[0].display_phone_number || phonesData.data[0].verified_name;
        }
      }

      // 4. Subscribe app to the WABA (required for webhooks)
      if (wabaId) {
        try {
          const subscribeRes = await fetch(
            `${GRAPH_API}/${wabaId}/subscribed_apps`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access_token: longLivedToken }),
            }
          );
          const subscribeData = await subscribeRes.json();
          console.log("Subscribe result:", JSON.stringify(subscribeData));
        } catch (e) {
          console.error("Failed to subscribe app:", e);
        }
      }

      // 5. Generate a random verify token for webhooks
      const verifyToken = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

      // 6. Store connection in database
      const config: Record<string, string> = {
        access_token: longLivedToken,
        waba_id: wabaId || "",
        phone_number_id: phoneNumberId || "",
        phone_display: phoneDisplay || "",
        verify_token: verifyToken,
        setup_method: "embedded_signup",
      };

      const { data, error: insertError } = await serviceClient
        .from("connection_configs")
        .insert({
          connection_id: "whatsapp",
          config,
          label: label || phoneDisplay || "WhatsApp (Embedded Signup)",
          is_connected: true,
          status: wabaId && phoneNumberId ? "active" : "pending_setup",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to save connection" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          id: data.id,
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          phone_display: phoneDisplay,
          status: wabaId && phoneNumberId ? "active" : "pending_setup",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Meta embedded signup error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
