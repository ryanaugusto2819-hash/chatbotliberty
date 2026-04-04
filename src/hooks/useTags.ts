import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTags(workspaceId?: string) {
  return useQuery({
    queryKey: ['tags', workspaceId],
    queryFn: async () => {
      let query = supabase.from('tags').select('*').order('name');
      if (workspaceId) query = query.eq('workspace_id', workspaceId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 10, // tags mudam raramente
    enabled: true,
  });
}
