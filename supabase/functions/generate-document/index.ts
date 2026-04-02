import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nome, cpf, tratamento_meses, valor, forma_pagamento, data_compra, empresa } = await req.json();

    if (!nome || !cpf || !tratamento_meses || !valor || !forma_pagamento || !data_compra) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const nomeEmpresa = empresa || "XXXXX";

    const prompt = `Generate a professional legal document image in Portuguese (Brazil). The document should look like a formal printed legal declaration on white paper with clean typography. Use Helvetica or similar professional font. The document must be perfectly readable with clear black text on white background.

The document title should be centered and bold:
"DECLARAÇÃO LEGAL DE COMPRA E CONDIÇÕES DE INADIMPLEMENTO:"

Then the body text (justified, regular weight):

"Eu, ${nome}, portador(a) do CPF nº ${cpf}, confirmo a compra do tratamento de ${tratamento_meses} meses com ${nomeEmpresa}, no valor de R$ ${valor}, com pagamento via ${forma_pagamento}.

Me comprometo a realizar o pagamento em no máximo 24 horas após o recebimento, conforme as condições previamente acordadas, estando ciente de todos os termos desta compra realizada em ${data_compra}.

Estou ciente de que as opções de pagamento aceitas são cartão de crédito, pix ou boleto à vista. O parcelamento é possível apenas no cartão de crédito, em até 12 vezes, enquanto o boleto deve ser pago à vista."

Then a bold section header:
"I. CONSEQUÊNCIAS DO INADIMPLEMENTO:"

Then body text:
"Em caso de inadimplemento (falta de pagamento), será aplicada uma multa de 10% sobre o valor da compra, juros de 1% ao mês, correção monetária com base no IGPM-FGV, e honorários advocatícios no percentual de 20% sobre o valor total devido.

Após o envio, estou ciente de que não será possível cancelar ou devolver o pedido, pois ele já estará em posse dos Correios e será entregue normalmente. Se os Correios não conseguirem a entrega, o produto ficará disponível na agência, e é minha obrigação retirá-lo na agência e efetuar o pagamento.

Reconheço que, em caso de inadimplência, recusa em receber ou não retirada nos Correios, a empresa poderá adotar medidas de recuperação de crédito, incluindo a negativação do meu CPF e processos judiciais, sendo o valor ainda devido em razão dos custos operacionais, logísticos e demais despesas envolvidas."

Then bold section header:
"II. AÇÕES LEGAIS RIGOROSAS:"

Then body text:
"Impacto no Crédito: Seu CPF será imediatamente inscrito em órgãos de proteção ao crédito, como SPC e Serasa, prejudicando sua capacidade de obter crédito no futuro.

Ação Judicial Imediata: Iniciaremos procedimentos legais para a cobrança do débito, com base nos Artigos 771 a 925 do Código de Processo Civil. Este processo pode resultar na penhora de bens e outras medidas severas.

Implicações Criminais: Qualquer indício de má-fé poderá levar a consequências criminais sob o Art. 171 do Código Penal."

Then bold final line:
"VOCÊ ESTÁ CIENTE E CONFIRMA OS TERMOS ACIMA PARA O ENVIO? Responda por escrito, sim ou não via Whatsapp."

IMPORTANT: Make it look like a real printed legal document. White background, black text, professional formatting. All text must be 100% readable and correctly spelled. Size should be like an A4 page portrait orientation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao gerar documento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "IA não retornou imagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ image_url: imageUrl }), {
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
