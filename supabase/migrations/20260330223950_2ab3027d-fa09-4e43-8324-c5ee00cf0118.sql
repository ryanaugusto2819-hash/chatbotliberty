CREATE TABLE IF NOT EXISTS pending_ai_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  processed_at timestamptz,
  CONSTRAINT unique_pending_conversation UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_ai_replies_scheduled
  ON pending_ai_replies (scheduled_for)
  WHERE processed_at IS NULL;

ALTER TABLE pending_ai_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage pending_ai_replies" ON pending_ai_replies FOR ALL TO public USING (true) WITH CHECK (true);