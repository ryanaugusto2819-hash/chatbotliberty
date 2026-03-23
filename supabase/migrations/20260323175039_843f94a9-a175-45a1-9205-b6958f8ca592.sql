
CREATE TABLE public.manager_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_prompt text NOT NULL DEFAULT '',
  evaluation_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage manager config" ON public.manager_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view manager config" ON public.manager_config
  FOR SELECT TO authenticated
  USING (true);

-- Insert default row
INSERT INTO public.manager_config (id, custom_prompt, evaluation_criteria)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Você é um GERENTE DE QUALIDADE especializado em atendimento ao cliente via WhatsApp.',
  '[{"name":"Qualidade das Respostas","weight":25,"description":"As respostas do bot/atendente foram claras, úteis e profissionais?"},{"name":"Precisão dos Fluxos","weight":25,"description":"Os fluxos de automação disparados foram adequados ao contexto?"},{"name":"Aderência ao Contexto","weight":25,"description":"As respostas mantiveram coerência com o histórico?"},{"name":"Identificação de Erros","weight":25,"description":"Houve respostas incorretas ou informações contraditórias?"}]'
);
