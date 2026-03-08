import { supabase } from "@/integrations/supabase/client";

export async function executeFlow(flowId: string, conversationId: string) {
  const { data, error } = await supabase.functions.invoke("execute-flow", {
    body: { flowId, conversationId },
  });

  if (error) throw error;
  return data;
}
