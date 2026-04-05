import { useNavigate } from 'react-router-dom';
import { useWorkspace, WorkspaceCountry, COUNTRY_LABELS, COUNTRY_FLAGS } from '@/contexts/WorkspaceContext';

const COUNTRIES: WorkspaceCountry[] = ['BR', 'UY'];

export default function CountrySwitcher() {
  const { country, workspacesByCountry, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const handleSelect = (c: WorkspaceCountry) => {
    if (c === country) return;
    const ws = workspacesByCountry(c);
    if (ws) {
      switchWorkspace(ws.id);
    } else {
      navigate(`/workspace/new?country=${c}`);
    }
  };

  return (
    <div
      className="flex items-center gap-1 rounded-xl p-1"
      style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.12)' }}
    >
      {COUNTRIES.map((c) => {
        const isActive = c === country;
        const has = !!workspacesByCountry(c);
        return (
          <button
            key={c}
            onClick={() => handleSelect(c)}
            title={`${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}${!has ? ' (criar)' : ''}`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 flex-1 justify-center"
            style={
              isActive
                ? {
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.35) 0%, rgba(124,58,237,0.2) 100%)',
                    color: '#C4B5FD',
                    boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                  }
                : {
                    color: has ? 'hsl(260 15% 52%)' : 'hsl(260 15% 35%)',
                    opacity: has ? 1 : 0.6,
                  }
            }
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.12)';
                (e.currentTarget as HTMLElement).style.color = 'hsl(260 15% 75%)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = '';
                (e.currentTarget as HTMLElement).style.color = has ? 'hsl(260 15% 52%)' : 'hsl(260 15% 35%)';
              }
            }}
          >
            <span className="text-base leading-none">{COUNTRY_FLAGS[c]}</span>
            <span className="hidden sm:inline truncate">{COUNTRY_LABELS[c]}</span>
            {!has && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded"
                style={{ background: 'rgba(124,58,237,0.15)', color: '#A78BFA' }}
              >
                +
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
