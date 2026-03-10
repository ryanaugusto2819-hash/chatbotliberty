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
    const { connectionId, config, action } = await req.json();

    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: "connectionId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle delete action
    if (action === "delete") {
      const { error: deleteError } = await serviceClient
        .from("connection_configs")
        .delete()
        .eq("connection_id", connectionId);

      if (deleteError) {
        console.error("Error deleting connection:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete connection" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Connection deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config) {
      return new Response(
        JSON.stringify({ error: "config is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build config based on connection type
    let savedConfig: Record<string, string> = {};

    if (connectionId === "whatsapp") {
      savedConfig = {
        phone_number_id: config.whatsapp_phone_number_id || "",
        configured_at: new Date().toISOString(),
      };
    } else if (connectionId === "zapi") {
      savedConfig = {
        instance_id: config.zapi_instance_id || "",
        client_token: config.zapi_client_token || "",
        configured_at: new Date().toISOString(),
      };
    }

    const { error: upsertError } = await serviceClient
      .from("connection_configs")
      .upsert(
        {
          connection_id: connectionId,
          is_connected: true,
          config: savedConfig,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "connection_id" }
      );

    if (upsertError) {
      console.error("Error saving connection config:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save connection config" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Connection saved" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Save connection error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
