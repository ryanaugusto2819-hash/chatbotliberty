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

  // Z-API sends POST for incoming messages
  if (req.method === "POST") {
    const body = await req.json();

    const processPromise = processZapiWebhook(body);
    processPromise.catch((err) =>
      console.error("Z-API webhook processing error:", err)
    );

    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  // GET for health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", provider: "z-api" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});

async function processZapiWebhook(body: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log("Z-API webhook received:", JSON.stringify(body));

  // Check if Z-API connection is active
  const { data: connectionConfig } = await supabase
    .from("connection_configs")
    .select("is_connected")
    .eq("connection_id", "zapi")
    .maybeSingle();

  if (!connectionConfig?.is_connected) {
    console.log("Z-API connection is not active, ignoring webhook");
    return;
  }

  // Z-API webhook format: https://developer.z-api.io/webhooks/on-message-received
  // Check if it's a received message
  if (!body.phone && !body.chatId) {
    console.log("Not a message event, skipping");
    return;
  }

  const phone = body.phone || body.chatId?.replace("@c.us", "");
  if (!phone) return;

  const contactName = body.senderName || body.chatName || phone;
  const isFromMe = body.fromMe === true;
  const isGroup = body.isGroup === true;
  // Z-API group phones contain "-group" or are old format like "number-number"
  const isGroupPhone = phone.includes("-group") || phone.includes("@g.us");

  // Skip messages sent by us or from groups
  if (isFromMe) {
    console.log("Message from self, skipping");
    return;
  }
  if (isGroup || isGroupPhone) {
    console.log("Group message, skipping");
    return;
  }

  // Upsert conversation
  let conversationId: string;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    conversationId = existing.id;
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString(), status: "active" })
      .eq("id", conversationId);
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        contact_name: contactName,
        contact_phone: phone,
        status: "new",
        tags: [],
      })
      .select("id")
      .single();

    if (convError) {
      console.error("Error creating conversation:", convError);
      return;
    }
    conversationId = newConv.id;
  }

  // Extract content based on Z-API message type
  let content = "";
  let messageType = "text";
  let mediaUrl: string | null = null;

  if (body.text?.message) {
    content = body.text.message;
    messageType = "text";
  } else if (body.image) {
    content = body.image.caption || "[Imagem]";
    messageType = "image";
    mediaUrl = body.image.imageUrl || body.image.url || null;
  } else if (body.audio) {
    content = "";
    messageType = "audio";
    mediaUrl = body.audio.audioUrl || body.audio.url || null;
    if (!mediaUrl) content = "[Áudio]";
  } else if (body.video) {
    content = body.video.caption || "";
    messageType = "video";
    mediaUrl = body.video.videoUrl || body.video.url || null;
    if (!content && !mediaUrl) content = "[Vídeo]";
  } else if (body.document) {
    content = body.document.fileName || "[Documento]";
    messageType = "document";
  } else if (body.sticker) {
    content = "[Sticker]";
    messageType = "text";
  } else if (body.contact) {
    content = "[Contato compartilhado]";
    messageType = "text";
  } else if (body.location) {
    content = `[Localização: ${body.location.latitude}, ${body.location.longitude}]`;
    messageType = "text";
  } else {
    content = body.body || "[Mensagem]";
  }

  // Normalize type
  const allowedTypes = ["text", "image", "document", "audio", "video"];
  const normalizedType = allowedTypes.includes(messageType) ? messageType : "text";

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    content,
    sender_type: "customer",
    message_type: normalizedType,
    media_url: mediaUrl,
    status: "delivered",
  });

  if (msgError) {
    console.error("Error inserting message:", msgError);
  } else {
    // Trigger AI flow selector first, then auto-reply as fallback
    triggerAiFlowSelector(conversationId).catch((err) =>
      console.error("Flow selector trigger error:", err)
    );
    triggerAutoReply(conversationId).catch((err) =>
      console.error("Auto-reply trigger error:", err)
    );
  }
}

async function triggerAiFlowSelector(conversationId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-flow-selector`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversationId }),
  });

  const result = await response.json();
  console.log("Flow selector result:", result);
}

async function triggerAutoReply(conversationId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-auto-reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversationId }),
  });

  const result = await response.json();
  console.log("Auto-reply result:", result);
}
