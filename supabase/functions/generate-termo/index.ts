import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateTermoPDF(vars: {
  nomeCliente: string;
  cpf: string;
  meses: string;
  valor: string;
  formaPagamento: string;
  dataCompra: string;
  empresa: string;
}): Promise<Uint8Array> {
  const { nomeCliente, cpf, meses, valor, formaPagamento, dataCompra, empresa } = vars;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const marginLeft = 50;
  const marginRight = 50;
  const contentWidth = width - marginLeft - marginRight;
  const fontSize = 10;
  const titleFontSize = 13;
  const sectionFontSize = 11;
  const lineHeight = 14;

  let y = height - 60;

  // Helper: wrap text into lines
  const wrapText = (text: string, font: typeof fontRegular, size: number, maxW: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      const w = font.widthOfTextAtSize(test, size);
      if (w > maxW && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  // Helper: draw wrapped text
  const drawText = (text: string, font: typeof fontRegular, size: number, indent = 0) => {
    const lines = wrapText(text, font, size, contentWidth - indent);
    for (const line of lines) {
      if (y < 50) {
        // Would need new page - content should fit on one page
        y = height - 50;
      }
      page.drawText(line, { x: marginLeft + indent, y, size, font, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
  };

  const addTitle = (text: string) => {
    drawText(text, fontBold, titleFontSize);
    y -= 8;
  };

  const addSectionTitle = (text: string) => {
    y -= 6;
    drawText(text, fontBold, sectionFontSize);
    y -= 4;
  };

  const addParagraph = (text: string) => {
    drawText(text, fontRegular, fontSize);
    y -= 6;
  };

  const addBullet = (text: string) => {
    // Draw bullet character
    const bulletLines = wrapText(text, fontRegular, fontSize, contentWidth - 15);
    for (let i = 0; i < bulletLines.length; i++) {
      if (y < 50) y = height - 50;
      const prefix = i === 0 ? "\u2022 " : "";
      const indent = i === 0 ? 0 : 15;
      page.drawText(prefix + bulletLines[i], {
        x: marginLeft + indent,
        y,
        size: fontSize,
        font: fontRegular,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }
    y -= 2;
  };

  // --- Content ---
  addTitle("DECLARACAO LEGAL DE COMPRA E CONDICOES DE INADIMPLEMENTO:");

  addParagraph(
    `Eu, ${nomeCliente}, portador(a) do CPF no ${cpf}, confirmo a compra do tratamento de ${meses} meses com ${empresa}, no valor de R$ ${valor}, com pagamento via ${formaPagamento}.`
  );

  addParagraph(
    `Me comprometo a realizar o pagamento em no maximo 24 horas apos o recebimento, conforme as condicoes previamente acordadas, estando ciente de todos os termos desta compra realizada em ${dataCompra}.`
  );

  addParagraph(
    "Estou ciente de que as opcoes de pagamento aceitas sao cartao de credito, pix ou boleto a vista. O parcelamento e possivel apenas no cartao de credito, em ate 12 vezes, enquanto o boleto deve ser pago a vista."
  );

  addSectionTitle("I. CONSEQUENCIAS DO INADIMPLEMENTO:");

  addParagraph(
    "Em caso de inadimplemento (falta de pagamento), sera aplicada uma multa de 10% sobre o valor da compra, juros de 1% ao mes, correcao monetaria com base no IGPM-FGV, e honorarios advocaticios no percentual de 20% sobre o valor total devido."
  );

  addParagraph(
    "Apos o envio, estou ciente de que nao sera possivel cancelar ou devolver o pedido, pois ele ja estara em posse dos Correios e sera entregue normalmente. Se os Correios nao conseguirem a entrega, o produto ficara disponivel na agencia, e e minha obrigacao retira-lo na agencia e efetuar o pagamento."
  );

  addParagraph(
    "Reconheco que, em caso de inadimplencia, recusa em receber ou nao retirada nos Correios, a empresa podera adotar medidas de recuperacao de credito, incluindo a negativacao do meu CPF e processos judiciais, sendo o valor ainda devido em razao dos custos operacionais, logisticos e demais despesas envolvidas."
  );

  addSectionTitle("II. ACOES LEGAIS RIGOROSAS:");

  addBullet(
    "Impacto no Credito: Seu CPF sera imediatamente inscrito em orgaos de protecao ao credito, como SPC e Serasa, prejudicando sua capacidade de obter credito no futuro."
  );

  addBullet(
    "Acao Judicial Imediata: Iniciaremos procedimentos legais para a cobranca do debito, com base nos Artigos 771 a 925 do Codigo de Processo Civil. Este processo pode resultar na penhora de bens e outras medidas severas."
  );

  addBullet(
    "Implicacoes Criminais: Qualquer indicio de ma-fe podera levar a consequencias criminais sob o Art. 171 do Codigo Penal."
  );

  y -= 10;
  drawText(
    "VOCE ESTA CIENTE E CONFIRMA OS TERMOS ACIMA PARA O ENVIO? Responda por escrito, sim ou nao via Whatsapp.",
    fontBold,
    fontSize
  );

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { conversationId, nomeCliente, cpf, meses, valor, formaPagamento, dataCompra, empresa, enviar } = body;

    if (!conversationId || !nomeCliente || !cpf || !meses) {
      return new Response(JSON.stringify({ error: "Campos obrigatorios: conversationId, nomeCliente, cpf, meses" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate PDF
    const pdfBytes = await generateTermoPDF({
      nomeCliente,
      cpf,
      meses,
      valor: valor || "397,00",
      formaPagamento: formaPagamento || "boleto a vista",
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
      const { data: conv } = await supabase
        .from("conversations")
        .select("connection_config_id, contact_phone")
        .eq("id", conversationId)
        .single();

      if (!conv) throw new Error("Conversa nao encontrada");

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
