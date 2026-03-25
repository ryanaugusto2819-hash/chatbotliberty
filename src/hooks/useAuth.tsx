import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'supervisor' | 'agent';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: AppRole | null;
  isApproved: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  role: null,
  isApproved: false,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isApproved, setIsApproved] = useState(false);

  const fetchUserMeta = async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('is_approved').eq('user_id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);

    setIsApproved(profileRes.data?.is_approved ?? false);

    const roles = roleRes.data?.map((r) => r.role) ?? [];
    if (roles.includes('admin')) setRole('admin');
    else if (roles.includes('supervisor')) setRole('supervisor');
    else setRole('agent');
  };

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        if (session?.user) {
          await fetchUserMeta(session.user.id);
        }
      } catch (e) {
        console.error('Error fetching session:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
      if (session?.user) {
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            if (mounted) setLoading(true);
            try {
              await fetchUserMeta(session.user.id);
            } catch (e) {
              console.error('Error fetching user meta:', e);
            } finally {
              if (mounted) setLoading(false);
            }
            return;
          }

          fetchUserMeta(session.user.id).catch((e) =>
            console.error('Error fetching user meta:', e)
          );
          if (mounted) setLoading(false);
        } else {
          setRole(null);
          setIsApproved(false);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, role, isApproved, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
