import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple PDF builder — generates a valid single-page PDF with the legal document
function buildPdf(text: { nome: string; cpf: string; tratamento_meses: string; valor: string; forma_pagamento: string; data_compra: string; empresa: string }) {
  const empresa = text.empresa || "XXXXX";

  // We'll build a PDF manually using raw PDF operators for maximum compatibility
  // Page size: A4 (595.28 x 841.89 points)
  const pageW = 595.28;
  const pageH = 841.89;
  const marginL = 60;
  const marginR = 60;
  const usableW = pageW - marginL - marginR;

  const lines: string[] = [];
  let cursorY = pageH - 60; // start from top

  function addLine(txt: string, fontSize: number, bold: boolean, spacing = 1.4) {
    lines.push({ text: txt, fontSize, bold, y: cursorY } as any);
    cursorY -= fontSize * spacing;
  }

  function addGap(pts: number) {
    cursorY -= pts;
  }

  // Build content lines
  const contentBlocks: Array<{ text: string; bold: boolean; fontSize: number; centered?: boolean; gap?: number }> = [
    { text: "DECLARAÇÃO LEGAL DE COMPRA E CONDIÇÕES DE INADIMPLEMENTO:", bold: true, fontSize: 13, centered: true, gap: 20 },
    { text: `Eu, ${text.nome}, portador(a) do CPF nº ${text.cpf}, confirmo a compra do tratamento de ${text.tratamento_meses} meses com ${empresa}, no valor de R$ ${text.valor}, com pagamento via ${text.forma_pagamento}.`, bold: false, fontSize: 10, gap: 8 },
    { text: `Me comprometo a realizar o pagamento em no máximo 24 horas após o recebimento, conforme as condições previamente acordadas, estando ciente de todos os termos desta compra realizada em ${text.data_compra}.`, bold: false, fontSize: 10, gap: 8 },
    { text: "Estou ciente de que as opções de pagamento aceitas são cartão de crédito, pix ou boleto à vista. O parcelamento é possível apenas no cartão de crédito, em até 12 vezes, enquanto o boleto deve ser pago à vista.", bold: false, fontSize: 10, gap: 16 },
    { text: "I. CONSEQUÊNCIAS DO INADIMPLEMENTO:", bold: true, fontSize: 11, gap: 10 },
    { text: "Em caso de inadimplemento (falta de pagamento), será aplicada uma multa de 10% sobre o valor da compra, juros de 1% ao mês, correção monetária com base no IGPM-FGV, e honorários advocatícios no percentual de 20% sobre o valor total devido.", bold: false, fontSize: 10, gap: 8 },
    { text: "Após o envio, estou ciente de que não será possível cancelar ou devolver o pedido, pois ele já estará em posse dos Correios e será entregue normalmente. Se os Correios não conseguirem a entrega, o produto ficará disponível na agência, e é minha obrigação retirá-lo na agência e efetuar o pagamento.", bold: false, fontSize: 10, gap: 8 },
    { text: "Reconheço que, em caso de inadimplência, recusa em receber ou não retirada nos Correios, a empresa poderá adotar medidas de recuperação de crédito, incluindo a negativação do meu CPF e processos judiciais, sendo o valor ainda devido em razão dos custos operacionais, logísticos e demais despesas envolvidas.", bold: false, fontSize: 10, gap: 16 },
    { text: "II. AÇÕES LEGAIS RIGOROSAS:", bold: true, fontSize: 11, gap: 10 },
    { text: "Impacto no Crédito: Seu CPF será imediatamente inscrito em órgãos de proteção ao crédito, como SPC e Serasa, prejudicando sua capacidade de obter crédito no futuro.", bold: false, fontSize: 10, gap: 8 },
    { text: "Ação Judicial Imediata: Iniciaremos procedimentos legais para a cobrança do débito, com base nos Artigos 771 a 925 do Código de Processo Civil. Este processo pode resultar na penhora de bens e outras medidas severas.", bold: false, fontSize: 10, gap: 8 },
    { text: "Implicações Criminais: Qualquer indício de má-fé poderá levar a consequências criminais sob o Art. 171 do Código Penal.", bold: false, fontSize: 10, gap: 16 },
    { text: "VOCÊ ESTÁ CIENTE E CONFIRMA OS TERMOS ACIMA PARA O ENVIO? Responda por escrito, sim ou não via Whatsapp.", bold: true, fontSize: 10, gap: 0 },
  ];

  // Word-wrap helper
  function wrapText(str: string, fontSize: number, maxWidth: number): string[] {
    // Approximate: Helvetica avg char width ~= fontSize * 0.5
    const charWidth = fontSize * 0.48;
    const maxChars = Math.floor(maxWidth / charWidth);
    const words = str.split(' ');
    const result: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars && current.length > 0) {
        result.push(current.trim());
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result;
  }

  // Escape PDF string
  function esc(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  // Build stream content
  let stream = '';
  let y = pageH - 70;

  for (const block of contentBlocks) {
    const fontName = block.bold ? '/F2' : '/F1';
    const wrapped = wrapText(block.text, block.fontSize, usableW);
    const lineHeight = block.fontSize * 1.5;

    for (const line of wrapped) {
      if (y < 60) break; // don't go below margin
      stream += `BT\n`;
      stream += `${fontName} ${block.fontSize} Tf\n`;
      if (block.centered) {
        const textWidth = line.length * block.fontSize * 0.48;
        const x = marginL + (usableW - textWidth) / 2;
        stream += `${x.toFixed(2)} ${y.toFixed(2)} Td\n`;
      } else {
        stream += `${marginL} ${y.toFixed(2)} Td\n`;
      }
      stream += `(${esc(line)}) Tj\n`;
      stream += `ET\n`;
      y -= lineHeight;
    }
    y -= (block.gap || 0);
  }

  // Build PDF structure
  const objects: string[] = [];
  let objCount = 0;

  function addObj(content: string): number {
    objCount++;
    objects.push(`${objCount} 0 obj\n${content}\nendobj`);
    return objCount;
  }

  // 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);
  // 2: Pages
  addObj(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  // 3: Page
  addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>`);
  // 4: Font Helvetica
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  // 5: Font Helvetica-Bold
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
  // 6: Stream
  const streamBytes = new TextEncoder().encode(stream);
  addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);

  // Build file
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let body = '';
  const xrefOffsets: number[] = [];
  let offset = header.length;

  for (const obj of objects) {
    xrefOffsets.push(offset);
    body += obj + '\n';
    offset += new TextEncoder().encode(obj + '\n').length;
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${objCount + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (const off of xrefOffsets) {
    xref += off.toString().padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const pdfStr = header + body + xref + trailer;
  return new TextEncoder().encode(pdfStr);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nome, cpf, tratamento_meses, valor, forma_pagamento, data_compra, empresa, conversation_id } = await req.json();

    if (!nome || !cpf || !tratamento_meses || !valor || !forma_pagamento || !data_compra) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = buildPdf({ nome, cpf, tratamento_meses, valor, forma_pagamento, data_compra, empresa });

    // Upload to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileName = `documents/${conversation_id || 'general'}/${Date.now()}_termo_${nome.replace(/\s+/g, '_')}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Falha ao salvar PDF: " + uploadError.message);
    }

    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);

    return new Response(JSON.stringify({ pdf_url: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
