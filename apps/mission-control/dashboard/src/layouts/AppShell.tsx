import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Activity,
  BookOpenText,
  Bot,
  ChevronDown,
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Sun,
  Users,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import { clearStoredSession, getStoredUser } from '../lib/auth';
import CommandPalette from '../components/CommandPalette';

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

  if (parts.length === 0) {
    workspace = 'mission-control';
    page = 'home';
  } else if (parts[0] === 'solar') {
    workspace = 'solar';
    page = parts[1] || 'overview';
    if (parts[1] === 'leads' && parts[2]) recordId = parts[2];
  } else if (parts[0] === 'crm') {
    workspace = 'crm';
    page = parts[1] || 'home';
    if (parts[1] === 'people' && parts[2]) recordId = parts[2];
  } else if (parts[0] === 'chat') {
    workspace = 'agents';
    page = 'chat';
  } else if (parts[0] === 'agents') {
    workspace = 'agents';
    page = parts[1] || 'workflow';
  } else if (parts[0] === 'system') {
    workspace = 'system';
    page = parts[1] || null;
  } else if (parts[0] === 'openclaw') {
    workspace = 'system';
    page = 'openclaw';
  } else if (parts[0] === 'settings') {
    workspace = 'system';
    page = 'settings';
  } else {
    workspace = 'mission-control';
    page = 'home';
  }

  return { route: pathname, workspace, page, recordId };
}

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Mission Control', icon: LayoutDashboard, end: true },
  { to: '/crm', label: 'CRM', icon: Users },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/agents', label: 'Agents', icon: Workflow },
  { to: '/solar/leads', label: 'Solar', icon: Sun },
];

const SYSTEM_NAV: NavItem[] = [
  { to: '/system/status', label: 'Status', icon: Activity },
  { to: '/system/activity', label: 'Activity', icon: Bot },
  { to: '/system/review', label: 'Review', icon: ClipboardCheck },
  { to: '/system/runs', label: 'Runs', icon: ListChecks },
  { to: '/system/tools', label: 'Tools', icon: Wrench },
  { to: '/system/flows', label: 'Flows', icon: GitBranch },
  { to: '/system/context', label: 'Context', icon: BookOpenText },
  { to: '/openclaw', label: 'OpenClaw', icon: Bot },
];

function NavLinkItem({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
          isActive ? 'mc-nav-active text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [systemOpen, setSystemOpen] = useState(true);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3">
        <div className="text-[10px] font-semibold tracking-wider text-white/40">Helping Hands</div>
        <div className="text-sm font-bold mt-0.5">Mission Control</div>
      </div>
      <nav className="flex-1 space-y-4 px-2 overflow-y-auto pb-4">
        <div className="space-y-0.5">
          {MAIN_NAV.map((item) => <NavLinkItem key={item.to} item={item} />)}
        </div>

        <div>
          <button
            onClick={() => setSystemOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white/35 hover:text-white/70 transition"
          >
            System
            <ChevronDown className={cx('h-3.5 w-3.5 transition', systemOpen ? 'rotate-180' : '')} />
          </button>
          {systemOpen && (
            <div className="mt-1 space-y-0.5">
              {SYSTEM_NAV.map((item) => <NavLinkItem key={item.to} item={item} />)}
            </div>
          )}
        </div>

        <NavLinkItem item={{ to: '/settings', label: 'Settings', icon: Settings }} />
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        <button onClick={onNavigate} className="w-full text-left">
          <div className="text-xs text-white/35 truncate">{getStoredUser()?.user_metadata?.full_name || getStoredUser()?.email || 'Signed in'}</div>
          <div className="mt-1 text-[10px] text-white/30 hover:text-white/60 transition">Logout</div>
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const loc = useLocation();
  const navigate = useNavigate();
  const context = useMemo(() => deriveContext(loc.pathname), [loc.pathname]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const userLabel = getStoredUser()?.user_metadata?.full_name || getStoredUser()?.email || null;

  const handleLogout = () => {
    clearStoredSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen text-white">
      <aside className="hidden md:flex mc-sidebar">
        <SidebarContent onNavigate={handleLogout} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="mc-topbar flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} className="mc-secondary-button md:hidden inline-flex">
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-xs font-semibold tracking-wide text-white/60">Helping Hands Systems</div>
          </div>
          <div className="flex items-center gap-2">
            {userLabel && <div className="hidden sm:block text-sm text-white/55">Signed in as {userLabel}</div>}
            <button onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))} className="mc-secondary-button hidden sm:inline-flex" title="Search (⌘K)">
              <Search className="h-4 w-4" />
              Search
            </button>
            <button onClick={() => navigate('/chat')} className="mc-primary-button hidden sm:inline-flex">
              Agent Chat
            </button>
            <button onClick={handleLogout} className="mc-secondary-button hidden md:inline-flex">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>

        <footer className="hidden md:block px-4 sm:px-6 lg:px-8 pb-4 text-xs text-white/35 max-w-7xl mx-auto w-full">
          Context: {context.workspace || 'mission-control'} / {context.page || 'home'}
        </footer>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-white/10 bg-[#070b18]">
            <div className="flex items-center justify-between px-4 pt-4">
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-white/40">Helping Hands</div>
                <div className="text-sm font-bold mt-0.5">Mission Control</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="mc-secondary-button inline-flex">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2" onClick={() => setDrawerOpen(false)}>
              <SidebarContent onNavigate={handleLogout} />
            </div>
          </div>
        </div>
      )}

      <CommandPalette />
    </div>
  );
}
