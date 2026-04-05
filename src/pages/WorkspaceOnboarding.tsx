import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace, WorkspaceCountry, COUNTRY_FLAGS } from '@/contexts/WorkspaceContext';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const COUNTRIES: { code: WorkspaceCountry; label: string; flag: string; placeholder: string }[] = [
  { code: 'BR', label: 'Brasil', flag: '🇧🇷', placeholder: 'Ex: Minha Empresa Brasil' },
  { code: 'UY', label: 'Uruguai', flag: '🇺🇾', placeholder: 'Ex: Mi Empresa Uruguay' },
];

export default function WorkspaceOnboarding() {
  const { user } = useAuth();
  const { refetch } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const preselected = searchParams.get('country') as WorkspaceCountry | null;
  const [step, setStep] = useState<'country' | 'name'>(preselected ? 'name' : 'country');
  const [selectedCountry, setSelectedCountry] = useState<WorkspaceCountry | null>(preselected);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const countryMeta = COUNTRIES.find((c) => c.code === selectedCountry);

  const handleSelectCountry = (code: WorkspaceCountry) => {
    setSelectedCountry(code);
    setStep('name');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user || !selectedCountry) return;

    setIsLoading(true);
    setError('');

    try {
      const slug = slugify(name);

      const { data, error: insertError } = await supabase
        .from('workspaces')
        .insert({ name: name.trim(), slug, owner_id: user.id, country: selectedCountry })
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
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
              style={{
                background: step === 'country' ? 'linear-gradient(135deg, #7c3aed, #9333ea)' : undefined,
                boxShadow: step === 'country' ? '0 4px 16px rgba(124,58,237,0.35)' : undefined,
              }}
            >
              {step === 'country' ? (
                <Building2 className="h-7 w-7 text-white" />
              ) : (
                <span>{countryMeta?.flag}</span>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 'country' ? (
              <motion.div
                key="country"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-xl font-bold text-center text-foreground mb-1">
                  Selecione o país
                </h1>
                <p className="text-sm text-center text-muted-foreground mb-8">
                  Cada país terá seu próprio espaço com dados completamente separados.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleSelectCountry(c.code)}
                      className="flex flex-col items-center gap-3 rounded-xl p-5 transition-all duration-150"
                      style={{
                        background: 'hsl(var(--muted))',
                        border: '2px solid hsl(var(--border))',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.border = '2px solid rgba(124,58,237,0.5)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(124,58,237,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.border = '2px solid hsl(var(--border))';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }}
                    >
                      <span className="text-4xl">{c.flag}</span>
                      <span className="text-sm font-semibold text-foreground">{c.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="name"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-xl font-bold text-center text-foreground mb-1">
                  Crie seu espaço de trabalho
                </h1>
                <p className="text-sm text-center text-muted-foreground mb-2">
                  Espaço para{' '}
                  <span className="font-semibold" style={{ color: '#A78BFA' }}>
                    {countryMeta?.flag} {countryMeta?.label}
                  </span>
                </p>
                <p className="text-xs text-center text-muted-foreground mb-8">
                  Dê um nome à sua empresa ou equipe para começar.
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
                      placeholder={countryMeta?.placeholder}
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

                  <div className="flex gap-2">
                    {!preselected && (
                      <button
                        type="button"
                        onClick={() => { setStep('country'); setError(''); }}
                        className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
                        style={{
                          background: 'hsl(var(--muted))',
                          border: '1px solid hsl(var(--border))',
                          color: 'hsl(var(--foreground))',
                        }}
                      >
                        Voltar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!name.trim() || isLoading}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                        boxShadow: name.trim() ? '0 4px 12px rgba(124,58,237,0.3)' : 'none',
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Criar espaço
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
