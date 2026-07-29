import { Hexagon, LogOut, User } from 'lucide-react';

interface HeaderProps {
  userName?: string | null;
  onSignOut?: () => void;
  role?: string | null;
  orgName?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Main Account Admin',
  manufacturer: 'Main Account',
  distributor: 'Sub-Account',
};

export default function Header({ userName, onSignOut, role, orgName }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          FUSION 44X – DEMO VISUAL ECOSYSTEM
        </h1>
        <p className="text-[13px] text-[#8BA0C4] mt-0.5">
          Enterprise CRM &amp; Automation Platform Overview
        </p>
      </div>
      <div className="flex items-center gap-3">
        {userName && (
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2">
            <User size={14} className="text-fusion-text-muted" />
            <span className="text-xs text-fusion-text-muted">{userName}</span>
          </div>
        )}
        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2">
          <Hexagon size={18} className="text-fusion-blue-light" />
          <span className="text-sm font-bold text-white tracking-wider">F44X</span>
          {role && (
            <span className="text-[10px] text-[#8BA0C4] font-medium">
              | {orgName || ROLE_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
          )}
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-fusion-text-muted hover:text-white hover:border-white/20 transition-all"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
