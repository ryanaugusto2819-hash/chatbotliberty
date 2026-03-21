-- Fix existing conversations with null niche_id by linking them to the Emagrecimento niche
-- since all current connections belong to that niche
UPDATE conversations 
SET niche_id = '618460f3-e62b-4c7b-95aa-123a6bd90ea0'
WHERE niche_id IS NULL;