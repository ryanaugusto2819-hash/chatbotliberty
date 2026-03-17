ALTER TABLE public.profiles ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Approve the admin user
UPDATE public.profiles SET is_approved = true WHERE user_id = 'f5000ba3-b966-434e-8df0-5d7271c4bfdf';

-- Create function to auto-approve admins
CREATE OR REPLACE FUNCTION public.auto_approve_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'admin') THEN
    NEW.is_approved = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_approve_admin_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_admin();