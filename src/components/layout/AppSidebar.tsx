import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import logoImg from '@/assets/logo-group-liberty.jpg';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Bot,
  GitBranch,
  Plug,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
  Clock,
} from 'lucide-react';

const allNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', adminOnly: false },
  { to: '/conversations', icon: MessageSquare, label: 'Conversas', adminOnly: false },
  { to: '/agents', icon: Users, label: 'Atendentes', adminOnly: true },
  { to: '/automation', icon: GitBranch, label: 'Automação', adminOnly: true },
  { to: '/ai', icon: Bot, label: 'Nichos & IA', adminOnly: true },
  { to: '/reports', icon: BarChart3, label: 'Relatórios', adminOnly: true },
  { to: '/manager-ai', icon: ShieldCheck, label: 'IA Gerente', adminOnly: true },
  
  { to: '/connections', icon: Plug, label: 'Conexões', adminOnly: true },
  { to: '/users', icon: ShieldCheck, label: 'Usuários', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Configurações', adminOnly: true },
];

export default function AppSidebar() {
  const location = useLocation();
  const { user, signOut, isAdmin } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      const { data } = await supabase.rpc('get_conversations_with_last_message');
      if (data) {
        const total = (data as any[]).filter(c => (c.unread_count || 0) > 0).length;
        setTotalUnread(total);
      }
    };
    fetchUnread();

    const channel = supabase
      .channel('sidebar-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => fetchUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
        <img src={logoImg} alt="Group Liberty" className="h-9 w-9 rounded-lg object-cover" />
        <div>
          <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">Group Liberty</h1>
          <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Atendimento</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
              <span className="truncate">{item.label}</span>
              {item.to === '/conversations' && totalUnread > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[10px] font-bold text-sidebar-primary-foreground">
                  {totalUnread}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar bg-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{displayName}</p>
            <p className="text-[11px] text-sidebar-foreground/60">{user?.email}</p>
          </div>
          <button onClick={signOut} className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
