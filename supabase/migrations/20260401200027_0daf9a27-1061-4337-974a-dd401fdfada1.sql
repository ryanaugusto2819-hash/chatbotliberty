
-- Table: conversion_leads (enriched lead tracking for CAPI)
CREATE TABLE IF NOT EXISTS public.conversion_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  wa_id text,
  phone text NOT NULL,
  waba_id text,
  ctwa_clid text,
  source_id text,
  source_type text,
  message_id text,
  first_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversion_lead_conversation UNIQUE (conversation_id)
);

-- Table: orders (sales/purchases linked to conversations)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  value numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: conversion_events (events sent to Meta CAPI)
CREATE TABLE IF NOT EXISTS public.conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.conversion_leads(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_id text NOT NULL,
  phone text,
  ctwa_clid text,
  value numeric(12,2),
  currency text DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending',
  payload_json jsonb DEFAULT '{}'::jsonb,
  response_json jsonb,
  sent_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_event_id UNIQUE (event_id)
);

-- Table: meta_capi_config (centralized CAPI configuration)
CREATE TABLE IF NOT EXISTS public.meta_capi_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id text NOT NULL DEFAULT '',
  access_token text NOT NULL DEFAULT '',
  api_version text NOT NULL DEFAULT 'v21.0',
  graph_base_url text NOT NULL DEFAULT 'https://graph.facebook.com',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversion_events_status ON public.conversion_events(status);
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_name ON public.conversion_events(event_name);
CREATE INDEX IF NOT EXISTS idx_conversion_events_conversation_id ON public.conversion_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversion_leads_phone ON public.conversion_leads(phone);
CREATE INDEX IF NOT EXISTS idx_orders_conversation_id ON public.orders(conversation_id);

-- RLS
ALTER TABLE public.conversion_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_capi_config ENABLE ROW LEVEL SECURITY;

-- conversion_leads policies
CREATE POLICY "Authenticated can view conversion_leads" ON public.conversion_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage conversion_leads" ON public.conversion_leads FOR ALL TO public USING (true) WITH CHECK (true);

-- orders policies
CREATE POLICY "Authenticated can view orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage orders" ON public.orders FOR ALL TO public USING (true) WITH CHECK (true);

-- conversion_events policies
CREATE POLICY "Authenticated can view conversion_events" ON public.conversion_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage conversion_events" ON public.conversion_events FOR ALL TO public USING (true) WITH CHECK (true);

-- meta_capi_config policies
CREATE POLICY "Admins can manage meta_capi_config" ON public.meta_capi_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view meta_capi_config" ON public.meta_capi_config FOR SELECT TO authenticated USING (true);

-- Realtime for conversion_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversion_events;
