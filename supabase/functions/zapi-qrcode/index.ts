import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { configId, action } = await req.json();

    if (!configId) {
      return jsonResponse({ error: "configId is required" }, 400);
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
      return jsonResponse({ error: "Connection not found" }, 404);
    }

    if (conn.connection_id !== "zapi") {
      return jsonResponse({ error: "Only Z-API connections support QR Code" }, 400);
    }

    const config = conn.config as Record<string, string>;
    const instanceId = config.instance_id;
    const token = config.token;
    const clientToken = config.client_token;

    if (!instanceId || !token) {
      return jsonResponse({ error: "Missing instance_id or token in config" }, 400);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (clientToken) headers["Client-Token"] = clientToken;

    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

    // Action: get status
    if (action === "status") {
      const res = await fetch(`${baseUrl}/status`, { headers });
      const data = await res.json();

      let connectionStatus = "disconnected";
      if (data.connected === true) {
        connectionStatus = "connected";
      } else if (data.smartPhoneConnected === false) {
        connectionStatus = "disconnected";
      }

      // Update DB status
      if (connectionStatus === "connected") {
        await supabase
          .from("connection_configs")
          .update({
            status: "active",
            is_connected: true,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", configId);
      }

      return jsonResponse({
        connectionStatus,
        phone: data.smartPhoneConnected ? data.phoneConnected : null,
        raw: data,
      });
    }

    // Action: get QR code
    if (action === "qrcode") {
      const res = await fetch(`${baseUrl}/qr-code/image`, { headers });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Z-API QR code error:", errText);
        return jsonResponse({ error: "Failed to get QR code from Z-API", details: errText }, 502);
      }

      const contentType = res.headers.get("content-type") || "";

      // Z-API may return JSON with error or image data
      if (contentType.includes("application/json")) {
        const data = await res.json();
        // Check if already connected
        if (data.connected === true || data.value === "isLogged") {
          return jsonResponse({ connectionStatus: "connected", qrCode: null });
        }
        // Some Z-API versions return base64 in JSON
        if (data.value) {
          return jsonResponse({ connectionStatus: "waiting_qr", qrCode: data.value });
        }
        return jsonResponse({ connectionStatus: "waiting_qr", qrCode: null, raw: data });
      }

      // Image response - convert to base64
      const imageBuffer = await res.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const mimeType = contentType.includes("png") ? "image/png" : "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return jsonResponse({ connectionStatus: "waiting_qr", qrCode: dataUrl });
    }

    // Action: disconnect
    if (action === "disconnect") {
      const res = await fetch(`${baseUrl}/disconnect`, {
        method: "POST",
        headers,
      });
      const data = await res.json();

      await supabase
        .from("connection_configs")
        .update({
          status: "unknown",
          is_connected: false,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", configId);

      return jsonResponse({ success: true, raw: data });
    }

    // Action: restart (force new QR)
    if (action === "restart") {
      try {
        await fetch(`${baseUrl}/restart`, { method: "POST", headers });
      } catch { /* ignore */ }
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action. Use: status, qrcode, disconnect, restart" }, 400);
  } catch (err) {
    console.error("zapi-qrcode error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
