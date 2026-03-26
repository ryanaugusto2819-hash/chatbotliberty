import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
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
  const currentUserIdRef = useRef<string | null>(null);
  const metaCacheRef = useRef<{ userId: string; role: AppRole; isApproved: boolean } | null>(null);
  const fetchingRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;
    let hasInitialized = false;

    const resetAuthState = () => {
      setRole(null);
      setIsApproved(false);
      metaCacheRef.current = null;
    };

    const fetchUserMeta = async (userId: string, showBlockingLoader = false) => {
      // Return cached data if available for same user
      if (metaCacheRef.current?.userId === userId) {
        setRole(metaCacheRef.current.role);
        setIsApproved(metaCacheRef.current.isApproved);
        if (showBlockingLoader) setLoading(false);
        return;
      }

      // Deduplicate concurrent fetches for the same user
      if (fetchingRef.current === userId) return;
      fetchingRef.current = userId;

      const currentRequestId = ++requestId;

      if (showBlockingLoader) {
        setLoading(true);
      }

      try {
        const [profileRes, roleRes] = await Promise.all([
          supabase.from('profiles').select('is_approved').eq('user_id', userId).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', userId),
        ]);

        if (!mounted || currentRequestId !== requestId) return;

        const approved = profileRes.data?.is_approved ?? false;
        setIsApproved(approved);

        const roles = roleRes.data?.map((r) => r.role) ?? [];
        let resolvedRole: AppRole = 'agent';
        if (roles.includes('admin')) resolvedRole = 'admin';
        else if (roles.includes('supervisor')) resolvedRole = 'supervisor';
        setRole(resolvedRole);

        // Cache the result
        metaCacheRef.current = { userId, role: resolvedRole, isApproved: approved };
      } catch (e) {
        if (!mounted || currentRequestId !== requestId) return;
        console.error('Error fetching user meta:', e);
        setRole(null);
        setIsApproved(false);
      } finally {
        fetchingRef.current = null;
        if (mounted && currentRequestId === requestId && showBlockingLoader) {
          setLoading(false);
        }
      }
    };

    const syncSession = (nextSession: Session | null, options?: { initialize?: boolean; blockUi?: boolean }) => {
      if (!mounted) return;

      const isInitialize = options?.initialize ?? false;
      const blockUi = options?.blockUi ?? false;

      setSession(nextSession);
      currentUserIdRef.current = nextSession?.user?.id ?? null;

      if (!nextSession?.user) {
        requestId += 1;
        resetAuthState();
        if (isInitialize || blockUi) {
          setLoading(false);
        }
        if (isInitialize) {
          hasInitialized = true;
        }
        return;
      }

      void fetchUserMeta(nextSession.user.id, blockUi || !hasInitialized);

      if (isInitialize) {
        hasInitialized = true;
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = nextSession?.user?.id ?? null;
      const isBackgroundSessionRefresh =
        event === 'SIGNED_IN' &&
        hasInitialized &&
        nextUserId !== null &&
        nextUserId === currentUserIdRef.current;

      const shouldBlockUi =
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED' ||
        (event === 'SIGNED_IN' && !isBackgroundSessionRefresh);

      syncSession(nextSession, { blockUi: shouldBlockUi });
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        syncSession(currentSession, { initialize: true, blockUi: true });
      })
      .catch((e) => {
        console.error('Error fetching session:', e);
        if (mounted) {
          setLoading(false);
          hasInitialized = true;
        }
      });

    return () => {
      mounted = false;
      requestId += 1;
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
