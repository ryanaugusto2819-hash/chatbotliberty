
-- Follow-up templates table
CREATE TABLE public.follow_up_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  message_template TEXT NOT NULL DEFAULT '',
  escalation_level INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  delay_hours INTEGER NOT NULL DEFAULT 24,
  active_hours_start INTEGER NOT NULL DEFAULT 8,
  active_hours_end INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Follow-up executions table
CREATE TABLE public.follow_up_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  message_sent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for templates
CREATE POLICY "Authenticated can view follow_up_templates" ON public.follow_up_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage follow_up_templates" ON public.follow_up_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS policies for executions
CREATE POLICY "Authenticated can view follow_up_executions" ON public.follow_up_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage follow_up_executions" ON public.follow_up_executions FOR ALL TO public USING (true) WITH CHECK (true);

-- Enable realtime for executions
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_up_executions;

-- Updated_at trigger for templates
CREATE TRIGGER update_follow_up_templates_updated_at BEFORE UPDATE ON public.follow_up_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
