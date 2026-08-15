import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { clearStoredSession, getStoredUser } from '../lib/auth';
import { supabase } from '../lib/supabase';

type SidekickContext = {
  route: string;
  workspace?: string | null;
  page?: string | null;
  recordId?: string | null;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function deriveContext(pathname: string): SidekickContext {
  const parts = pathname.split('/').filter(Boolean);

  let workspace: string | null = null;
  let page: string | null = null;
  let recordId: string | null = null;

  if (parts[0] === 'solar') {
    workspace = 'solar';
    page = parts[1] || 'overview';
    if (parts[1] === 'leads' && parts[2]) recordId = parts[2];
  } else if (parts[0] === 'crm') {
    workspace = 'crm';
    page = parts[1] || 'overview';
    if (parts[1] === 'people' && parts[2]) recordId = parts[2];
  } else if (parts[0] === 'system') {
    workspace = 'system';
    page = parts[1] || null;
  } else if (parts[0] === 'agents') {
    workspace = 'agents';
    page = 'console';
  } else if (parts[0] === 'mission-control') {
    workspace = 'agents';
    page = 'mission-control';
  } else if (parts[0] === 'settings') {
    workspace = 'system';
    page = 'settings';
  } else {
    workspace = 'hhs';
    page = 'home';
  }

  return { route: pathname, workspace, page, recordId };
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', glyph: 'H' },
  { to: '/crm', label: 'CRM', glyph: 'C' },
  { to: '/agents', label: 'Chat', glyph: 'A' },
  { to: '/mission-control', label: 'Mission Control', glyph: 'M' },
  { to: '/solar/leads', label: 'Solar', glyph: 'S' },
  { to: '/system/tools', label: 'Tools', glyph: 'T' },
  { to: '/system/flows', label: 'Flows', glyph: 'F' },
  { to: '/system/activity', label: 'Activity', glyph: 'E' },
  { to: '/system/review', label: 'Review', glyph: 'R' },
  { to: '/system/context', label: 'Context', glyph: 'X' },
  { to: '/openclaw', label: 'OpenClaw', glyph: 'O' },
  { to: '/settings', label: 'Settings', glyph: 'S' },
];

export function AppShell() {
  const loc = useLocation();
  const navigate = useNavigate();
  const context = useMemo(() => deriveContext(loc.pathname), [loc.pathname]);

  const userLabel = useMemo(() => {
    const user = getStoredUser();
    return user?.user_metadata?.full_name || user?.email || null;
  }, [loc.pathname]);

  const handleLogout = () => {
    if (supabase) void supabase.auth.signOut();
    clearStoredSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen text-white">
      <aside className="hidden md:flex mc-sidebar">
        <div className="flex flex-col h-full">
          <div className="px-4 pt-5 pb-3">
            <div className="text-[10px] font-semibold tracking-wider text-white/40">Helping Hands</div>
            <div className="text-sm font-bold mt-0.5">Mission Control</div>
          </div>
          <nav className="flex-1 space-y-0.5 px-2 overflow-y-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'mc-nav-active text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                )}
                end={item.to === '/'}
              >
                <span className="grid w-6 h-6 place-items-center rounded-lg bg-white/10 text-[11px] font-black">{item.glyph}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 px-3 py-3">
            <div className="text-xs text-white/35 truncate">{userLabel || 'Signed in'}</div>
            <button onClick={handleLogout} className="mt-1 text-[10px] text-white/30 hover:text-white/60 transition">
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="mc-topbar flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold tracking-wide text-white/60">Helping Hands Systems</div>
          </div>
          <div className="flex items-center gap-2">
            {userLabel && <div className="hidden sm:block text-sm text-white/55">Signed in as {userLabel}</div>}
            <button onClick={() => navigate('/system/context')} className="mc-secondary-button hidden sm:inline-flex">
              Context
            </button>
            <button onClick={() => navigate('/mission-control')} className="mc-secondary-button hidden sm:inline-flex">
              Mission Control
            </button>
            <button onClick={() => navigate('/agents')} className="mc-primary-button hidden sm:inline-flex">
              Agent Chat
            </button>
            <button onClick={handleLogout} className="mc-secondary-button hidden md:inline-flex">
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-[140px] md:pb-[70px] max-w-7xl mx-auto w-full">
          <Outlet />
        </main>

        <footer className="hidden md:block px-4 sm:px-6 lg:px-8 pb-4 text-xs text-white/35 max-w-7xl mx-auto w-full">
          Context: {context.workspace || 'hhs'} / {context.page || 'home'}
        </footer>
      </div>

      <nav className="mc-bottom-nav md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cx('mc-bottom-nav-item', isActive && 'mc-bottom-nav-item-active')}
            end={item.to === '/'}
          >
            <span>{item.glyph}</span>
            <small>{item.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
