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

  try {
    const { sourceId, conversationId } = await req.json();

    if (!sourceId) {
      return new Response(
        JSON.stringify({ success: false, error: "sourceId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to get per-connection token first
    let accessToken: string | null = null;

    if (conversationId) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("connection_config_id")
        .eq("id", conversationId)
        .single();

      if (conv?.connection_config_id) {
        const { data: connConfig } = await supabase
          .from("connection_configs")
          .select("config")
          .eq("id", conv.connection_config_id)
          .single();

        const config = connConfig?.config as Record<string, string> | null;
        if (config?.meta_ads_token?.trim()) {
          accessToken = config.meta_ads_token.trim();
          console.log(`Using per-connection Meta Ads token for connection ${conv.connection_config_id}`);
        }
      }
    }

    // Fallback to global secret
    if (!accessToken) {
      accessToken = Deno.env.get("META_ADS_ACCESS_TOKEN") || null;
      if (accessToken) {
        console.log("Using global META_ADS_ACCESS_TOKEN");
      }
    }

    if (!accessToken) {
      console.error("No Meta Ads access token available");
      return new Response(
        JSON.stringify({ success: false, error: "No Meta Ads access token configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query Meta Marketing API for ad details
    const adResponse = await fetch(
      `https://graph.facebook.com/v21.0/${sourceId}?fields=name,campaign{name},adset{name},status,creative{title,body}&access_token=${accessToken}`
    );

    if (!adResponse.ok) {
      const errorText = await adResponse.text();
      console.error(`Meta API error [${adResponse.status}]:`, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Meta API error: ${adResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adData = await adResponse.json();
    console.log("Ad data fetched:", JSON.stringify(adData));

    const adName = adData.name || null;
    const campaignName = adData.campaign?.name || null;
    const adsetName = adData.adset?.name || null;

    // Build a descriptive ad_title
    const parts = [campaignName, adsetName, adName].filter(Boolean);
    const adTitle = parts.length > 0 ? parts.join(" › ") : null;

    // Update conversation with ad info if conversationId provided
    if (conversationId && adTitle) {
      await supabase
        .from("conversations")
        .update({ ad_title: adTitle })
        .eq("id", conversationId);

      console.log(`Updated conversation ${conversationId} with ad_title: ${adTitle}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        adName,
        campaignName,
        adsetName,
        adTitle,
        raw: adData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("meta-ad-lookup error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
