import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET = Meta webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // POST = Incoming messages from Meta
  if (req.method === "POST") {
    // Respond immediately to Meta (high-throughput strategy)
    const body = await req.json();

    // Process asynchronously - don't block the response
    const processPromise = processWebhook(body);

    // Return 200 immediately to Meta to avoid retries
    // Use waitUntil pattern via EdgeRuntime
    processPromise.catch((err) =>
      console.error("Webhook processing error:", err)
    );

    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});

async function downloadWhatsAppMedia(mediaId: string, accessToken: string): Promise<{ url: string; mimeType: string } | null> {
  try {
    // Step 1: Get the media URL from Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      console.error("Failed to get media metadata:", await metaRes.text());
      return null;
    }
    const meta = await metaRes.json();
    const downloadUrl = meta.url;
    const mimeType = meta.mime_type || "application/octet-stream";

    // Step 2: Download the binary
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      console.error("Failed to download media:", fileRes.status);
      return null;
    }
    const blob = await fileRes.blob();

    // Step 3: Determine extension
    const extMap: Record<string, string> = {
      "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/aac": "aac",
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "video/3gpp": "3gp",
      "application/pdf": "pdf",
    };
    const ext = extMap[mimeType] || "bin";
    const fileName = `incoming-${mediaId}.${ext}`;

    // Step 4: Upload to Supabase storage
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: uploadError } = await supabase.storage
      .from("automation-media")
      .upload(fileName, blob, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from("automation-media")
      .getPublicUrl(fileName);

    return { url: publicUrl.publicUrl, mimeType };
  } catch (err) {
    console.error("downloadWhatsAppMedia error:", err);
    return null;
  }
}

async function processWebhook(body: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const entries = body?.entry;
  if (!entries?.length) return;

  for (const entry of entries) {
    const changes = entry?.changes;
    if (!changes?.length) continue;

    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value = change.value;
      const messages = value?.messages;
      const contacts = value?.contacts;

      if (!messages?.length) continue;

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const contact = contacts?.[i] || contacts?.[0];
        const phone = msg.from;
        const contactName = contact?.profile?.name || phone;

        // Extract referral data (CTWA ads)
        const referral = msg.referral || value?.metadata?.referral;
        const ctwaClid = referral?.ctwa_clid || null;
        const sourceId = referral?.source_id || null;
        const adTitle = referral?.headline || referral?.body || referral?.source_url || null;

        // Upsert conversation (find or create by phone)
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
          // Update last activity + referral data if present
          const updateData: any = { updated_at: new Date().toISOString(), status: "active" };
          if (ctwaClid) updateData.ctwa_clid = ctwaClid;
          if (sourceId) updateData.source_id = sourceId;
          if (adTitle) updateData.ad_title = adTitle;
          await supabase
            .from("conversations")
            .update(updateData)
            .eq("id", conversationId);
        } else {
          const { data: newConv, error: convError } = await supabase
            .from("conversations")
            .insert({
              contact_name: contactName,
              contact_phone: phone,
              status: "new",
              tags: [],
              ctwa_clid: ctwaClid,
              source_id: sourceId,
              ad_title: adTitle,
            })
            .select("id")
            .single();

          if (convError) {
            console.error("Error creating conversation:", convError);
            continue;
          }
          conversationId = newConv.id;
        }

        // Extract message content based on type
        let content = "";
        let messageType = msg.type || "text";
        let mediaUrl: string | null = null;

        // Get access token for media downloads
        const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";

        switch (msg.type) {
          case "text":
            content = msg.text?.body || "";
            break;
          case "image": {
            content = msg.image?.caption || "";
            messageType = "image";
            const imgMediaId = msg.image?.id;
            if (imgMediaId && accessToken) {
              const result = await downloadWhatsAppMedia(imgMediaId, accessToken);
              if (result) mediaUrl = result.url;
            }
            if (!content && !mediaUrl) content = "[Imagem]";
            break;
          }
          case "audio": {
            messageType = "audio";
            const audioMediaId = msg.audio?.id;
            if (audioMediaId && accessToken) {
              const result = await downloadWhatsAppMedia(audioMediaId, accessToken);
              if (result) mediaUrl = result.url;
            }
            if (!mediaUrl) content = "[Áudio]";
            break;
          }
          case "video": {
            content = msg.video?.caption || "";
            messageType = "video";
            const videoMediaId = msg.video?.id;
            if (videoMediaId && accessToken) {
              const result = await downloadWhatsAppMedia(videoMediaId, accessToken);
              if (result) mediaUrl = result.url;
            }
            if (!content && !mediaUrl) content = "[Vídeo]";
            break;
          }
          case "document":
            content = msg.document?.filename || "[Documento]";
            messageType = "document";
            break;
          case "location":
            content = `[Localização: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
            messageType = "location";
            break;
          case "sticker":
            content = "[Sticker]";
            messageType = "sticker";
            break;
          case "contacts":
            content = "[Contato compartilhado]";
            messageType = "contacts";
            break;
          case "reaction":
            content = msg.reaction?.emoji || "[Reação]";
            messageType = "reaction";
            break;
          default:
            content = `[${msg.type || "Desconhecido"}]`;
        }

        // Insert message
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
          // Trigger AI flow selector and auto-reply asynchronously
          triggerAiFlowSelector(conversationId).catch((err) =>
            console.error("Flow selector trigger error:", err)
          );
          triggerAutoReply(conversationId).catch((err) =>
            console.error("Auto-reply trigger error:", err)
          );
        }
      }

      // Process status updates (delivery receipts)
      const statuses = value?.statuses;
      if (statuses?.length) {
        for (const status of statuses) {
          console.log(
            `Status update: ${status.id} -> ${status.status}`
          );
        }
      }
    }
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
