
CREATE TABLE public.agent_assignment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.agent_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on agent_assignment_history" ON public.agent_assignment_history FOR ALL USING (true) WITH CHECK (true);

-- Trigger to auto-log when assigned_agent_id changes on conversations
CREATE OR REPLACE FUNCTION public.log_agent_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Close previous assignment
  IF OLD.assigned_agent_id IS NOT NULL AND OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
    UPDATE public.agent_assignment_history
    SET unassigned_at = now()
    WHERE conversation_id = NEW.id AND agent_id = OLD.assigned_agent_id AND unassigned_at IS NULL;
  END IF;

  -- Log new assignment
  IF NEW.assigned_agent_id IS NOT NULL AND NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
    INSERT INTO public.agent_assignment_history (conversation_id, agent_id)
    VALUES (NEW.id, NEW.assigned_agent_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_agent_assignment
AFTER UPDATE OF assigned_agent_id ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.log_agent_assignment();
