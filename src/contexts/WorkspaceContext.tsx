import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type WorkspaceCountry = 'BR' | 'UY';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: string;
  max_agents: number;
  max_connections: number;
  is_active: boolean;
  country: WorkspaceCountry | null;
  created_at: string;
  updated_at: string;
}

export const COUNTRY_LABELS: Record<WorkspaceCountry, string> = {
  BR: 'Brasil',
  UY: 'Uruguai',
};

export const COUNTRY_FLAGS: Record<WorkspaceCountry, string> = {
  BR: '🇧🇷',
  UY: '🇺🇾',
};

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  isLoading: boolean;
  country: WorkspaceCountry | null;
  workspacesByCountry: (country: WorkspaceCountry) => Workspace | undefined;
  switchWorkspace: (id: string) => void;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = 'chatbotliberty_workspace_id';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Get all workspaces the user is a member of
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(*)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      const list: Workspace[] = (data ?? [])
        .map((row: any) => row.workspaces)
        .filter(Boolean)
        .filter((w: Workspace) => w.is_active);

      setWorkspaces(list);

      // Auto-select: prefer stored id, fall back to first workspace
      const stored = localStorage.getItem(STORAGE_KEY);
      const valid = stored && list.find((w) => w.id === stored);
      if (valid) {
        setWorkspaceId(stored);
      } else if (list.length > 0) {
        const first = list[0].id;
        setWorkspaceId(first);
        localStorage.setItem(STORAGE_KEY, first);
      } else {
        setWorkspaceId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.error('[WorkspaceContext] fetchWorkspaces error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const switchWorkspace = (id: string) => {
    setWorkspaceId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const workspace = workspaces.find((w) => w.id === workspaceId) ?? null;
  const country = (workspace?.country ?? null) as WorkspaceCountry | null;

  const workspacesByCountry = (c: WorkspaceCountry) =>
    workspaces.find((w) => w.country === c);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaces,
        workspaceId,
        isLoading,
        country,
        workspacesByCountry,
        switchWorkspace,
        refetch: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
