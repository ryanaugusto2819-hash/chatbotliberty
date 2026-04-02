import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PDF generation using raw byte stream (PDF/1.4)
function generateTermoPDF(vars: {
  nomeCliente: string;
  cpf: string;
  meses: string;
  valor: string;
  formaPagamento: string;
  dataCompra: string;
  empresa: string;
}): Uint8Array {
  const { nomeCliente, cpf, meses, valor, formaPagamento, dataCompra, empresa } = vars;

  // Helper to encode text to PDF Latin encoding
  const encodePdfText = (text: string): string => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/á/g, "\\341")
      .replace(/à/g, "\\340")
      .replace(/ã/g, "\\343")
      .replace(/â/g, "\\342")
      .replace(/é/g, "\\351")
      .replace(/ê/g, "\\352")
      .replace(/í/g, "\\355")
      .replace(/ó/g, "\\363")
      .replace(/ô/g, "\\364")
      .replace(/õ/g, "\\365")
      .replace(/ú/g, "\\372")
      .replace(/ü/g, "\\374")
      .replace(/ç/g, "\\347")
      .replace(/Á/g, "\\301")
      .replace(/À/g, "\\300")
      .replace(/Ã/g, "\\303")
      .replace(/Â/g, "\\302")
      .replace(/É/g, "\\311")
      .replace(/Ê/g, "\\312")
      .replace(/Í/g, "\\315")
      .replace(/Ó/g, "\\323")
      .replace(/Ô/g, "\\324")
      .replace(/Õ/g, "\\325")
      .replace(/Ú/g, "\\332")
      .replace(/Ç/g, "\\307")
      .replace(/º/g, "\\272")
      .replace(/ª/g, "\\252");
  };

  // Word wrap helper
  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    const charWidth = fontSize * 0.45; // approximate
    const maxChars = Math.floor(maxWidth / charWidth);
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + " " + word).trim().length > maxChars) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + " " + word : word;
      }
    }
    if (currentLine) lines.push(currentLine.trim());
    return lines;
  };

  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 50;
  const marginRight = 50;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const fontSize = 10;
  const titleFontSize = 13;
  const sectionFontSize = 11;
  const lineHeight = 14;

  // Build content blocks
  let y = pageHeight - 60;
  const commands: string[] = [];

  const addTitle = (text: string) => {
    const encoded = encodePdfText(text);
    commands.push(`BT /F1 ${titleFontSize} Tf ${marginLeft} ${y} Td (${encoded}) Tj ET`);
    y -= titleFontSize + 12;
  };

  const addSectionTitle = (text: string) => {
    y -= 8;
    const encoded = encodePdfText(text);
    commands.push(`BT /F1 ${sectionFontSize} Tf ${marginLeft} ${y} Td (${encoded}) Tj ET`);
    y -= sectionFontSize + 6;
  };

  const addParagraph = (text: string) => {
    const lines = wrapText(text, contentWidth, fontSize);
    for (const line of lines) {
      if (y < 50) {
        // Would need second page, but content should fit
        y = pageHeight - 50;
      }
      const encoded = encodePdfText(line);
      commands.push(`BT /F2 ${fontSize} Tf ${marginLeft} ${y} Td (${encoded}) Tj ET`);
      y -= lineHeight;
    }
    y -= 6;
  };

  const addBullet = (text: string) => {
    const lines = wrapText(text, contentWidth - 15, fontSize);
    for (let i = 0; i < lines.length; i++) {
      const encoded = encodePdfText(lines[i]);
      if (i === 0) {
        commands.push(`BT /F2 ${fontSize} Tf ${marginLeft} ${y} Td (\\267 ${encoded}) Tj ET`);
      } else {
        commands.push(`BT /F2 ${fontSize} Tf ${marginLeft + 15} ${y} Td (${encoded}) Tj ET`);
      }
      y -= lineHeight;
    }
    y -= 2;
  };

  // --- Content ---
  addTitle("DECLARA\\307\\303O LEGAL DE COMPRA E CONDI\\307\\325ES DE INADIMPLEMENTO:");

  addParagraph(
    `Eu, ${nomeCliente}, portador(a) do CPF n\\272 ${cpf}, confirmo a compra do tratamento de ${meses} meses com ${empresa}, no valor de R$ ${valor}, com pagamento via ${formaPagamento}.`
  );

  addParagraph(
    `Me comprometo a realizar o pagamento em no m\\341ximo 24 horas ap\\363s o recebimento, conforme as condi\\347\\365es previamente acordadas, estando ciente de todos os termos desta compra realizada em ${dataCompra}.`
  );

  addParagraph(
    "Estou ciente de que as op\\347\\365es de pagamento aceitas s\\343o cart\\343o de cr\\351dito, pix ou boleto \\340 vista. O parcelamento \\351 poss\\355vel apenas no cart\\343o de cr\\351dito, em at\\351 12 vezes, enquanto o boleto deve ser pago \\340 vista."
  );

  addSectionTitle("I. CONSEQU\\312NCIAS DO INADIMPLEMENTO:");

  addParagraph(
    "Em caso de inadimplemento (falta de pagamento), ser\\341 aplicada uma multa de 10% sobre o valor da compra, juros de 1% ao m\\352s, corre\\347\\343o monet\\341ria com base no IGPM-FGV, e honor\\341rios advocat\\355cios no percentual de 20% sobre o valor total devido."
  );

  addParagraph(
    "Ap\\363s o envio, estou ciente de que n\\343o ser\\341 poss\\355vel cancelar ou devolver o pedido, pois ele j\\341 estar\\341 em posse dos Correios e ser\\341 entregue normalmente. Se os Correios n\\343o conseguirem a entrega, o produto ficar\\341 dispon\\355vel na ag\\352ncia, e \\351 minha obriga\\347\\343o retir\\341-lo na ag\\352ncia e efetuar o pagamento."
  );

  addParagraph(
    "Reconhe\\347o que, em caso de inadimpl\\352ncia, recusa em receber ou n\\343o retirada nos Correios, a empresa poder\\341 adotar medidas de recupera\\347\\343o de cr\\351dito, incluindo a negativa\\347\\343o do meu CPF e processos judiciais, sendo o valor ainda devido em raz\\343o dos custos operacionais, log\\355sticos e demais despesas envolvidas."
  );

  addSectionTitle("II. A\\307\\325ES LEGAIS RIGOROSAS:");

  addBullet(
    "Impacto no Cr\\351dito: Seu CPF ser\\341 imediatamente inscrito em \\363rg\\343os de prote\\347\\343o ao cr\\351dito, como SPC e Serasa, prejudicando sua capacidade de obter cr\\351dito no futuro."
  );

  addBullet(
    "A\\347\\343o Judicial Imediata: Iniciaremos procedimentos legais para a cobran\\347a do d\\351bito, com base nos Artigos 771 a 925 do C\\363digo de Processo Civil. Este processo pode resultar na penhora de bens e outras medidas severas."
  );

  addBullet(
    "Implica\\347\\365es Criminais: Qualquer ind\\355cio de m\\341-f\\351 poder\\341 levar a consequ\\352ncias criminais sob o Art. 171 do C\\363digo Penal."
  );

  y -= 10;
  addParagraph(
    "VOC\\312 EST\\301 CIENTE E CONFIRMA OS TERMOS ACIMA PARA O ENVIO? Responda por escrito, sim ou n\\343o via Whatsapp."
  );

  // Build PDF
  const stream = commands.join("\n");
  const streamLength = new TextEncoder().encode(stream).length;

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj

4 0 obj
<< /Length ${streamLength} >>
stream
${stream}
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>
endobj

6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj

xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000314 00000 n 
${String(383 + streamLength).padStart(10, "0")} 00000 n 
${String(483 + streamLength).padStart(10, "0")} 00000 n 

trailer
<< /Size 7 /Root 1 0 R >>
startxref
${573 + streamLength}
%%EOF`;

  return new TextEncoder().encode(pdf);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { conversationId, nomeCliente, cpf, meses, valor, formaPagamento, dataCompra, empresa, enviar } = body;

    if (!conversationId || !nomeCliente || !cpf || !meses) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: conversationId, nomeCliente, cpf, meses" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate PDF
    const pdfBytes = generateTermoPDF({
      nomeCliente,
      cpf,
      meses,
      valor: valor || "397,00",
      formaPagamento: formaPagamento || "boleto à vista",
      dataCompra: dataCompra || new Date().toLocaleDateString("pt-BR"),
      empresa: empresa || "MEGAFIT",
    });

    // Upload to storage
    const fileName = `${conversationId}/termo_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(fileName, pdfBytes, { contentType: "application/pdf" });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(fileName);
    const pdfUrl = urlData.publicUrl;

    // If enviar=true, send via WhatsApp
    if (enviar) {
      // Get conversation's connection to decide which send function to use
      const { data: conv } = await supabase
        .from("conversations")
        .select("connection_config_id, contact_phone")
        .eq("id", conversationId)
        .single();

      if (!conv) throw new Error("Conversa não encontrada");

      let functionName = "whatsapp-send";

      if (conv.connection_config_id) {
        const { data: connConfig } = await supabase
          .from("connection_configs")
          .select("connection_id")
          .eq("id", conv.connection_config_id)
          .single();

        if (connConfig?.connection_id === "zapi") {
          functionName = "zapi-send";
        }
      }

      // Call the send function
      const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${functionName}`;
      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          conversationId,
          message: "",
          mediaUrl: pdfUrl,
          type: "document",
          senderLabel: "humano",
        }),
      });

      const sendResult = await sendRes.json();

      return new Response(JSON.stringify({ success: true, pdfUrl, sent: true, sendResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, pdfUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-termo error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
