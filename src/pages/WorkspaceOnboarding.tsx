import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function WorkspaceOnboarding() {
  const { user } = useAuth();
  const { refetch } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setIsLoading(true);
    setError('');

    try {
      const slug = slugify(name);

      const { data, error: insertError } = await supabase
        .from('workspaces')
        .insert({ name: name.trim(), slug, owner_id: user.id })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Já existe uma empresa com esse nome. Tente outro nome.');
        } else {
          setError('Erro ao criar empresa. Tente novamente.');
        }
        return;
      }

      localStorage.setItem('chatbotliberty_workspace_id', data.id);
      await refetch();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[WorkspaceOnboarding] error:', err);
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
              }}
            >
              <Building2 className="h-7 w-7 text-white" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-center text-foreground mb-1">
            Crie seu espaço de trabalho
          </h1>
          <p className="text-sm text-center text-muted-foreground mb-8">
            Dê um nome à sua empresa ou equipe para começar a usar a plataforma.
          </p>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="ws-name"
                className="block text-sm font-semibold text-foreground mb-1.5"
              >
                Nome da empresa / equipe
              </label>
              <input
                id="ws-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Minha Empresa"
                autoFocus
                maxLength={80}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(124,58,237,0.5)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1px solid hsl(var(--border))';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {error && (
                <p className="text-xs text-red-500 mt-1.5">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                boxShadow: name.trim() ? '0 4px 12px rgba(124,58,237,0.3)' : 'none',
              }}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Criar espaço de trabalho
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
