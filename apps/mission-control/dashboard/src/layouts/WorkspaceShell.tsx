import { NavLink, Outlet } from 'react-router-dom';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function WorkspaceShell(props: { workspaceLabel: string; basePath: string; nav: Array<{ to: string; label: string }> }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="px-1">
            <div className="text-xs font-semibold tracking-wide text-white/50">Workspace</div>
            <div className="mt-1 text-lg font-bold">{props.workspaceLabel}</div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          {props.nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cx(
                  'shrink-0 px-3 py-2 rounded-2xl text-sm font-semibold border transition',
                  isActive ? 'bg-emerald-500/15 border-emerald-400/25 text-emerald-100' : 'bg-white/0 border-white/10 hover:bg-white/10'
                )
              }
              end={n.to === props.basePath}
            >
              {n.label}
            </NavLink>
          ))}
          </div>
        </div>
      </section>

      <div className="space-y-4 sm:space-y-6">
        <Outlet />
      </div>
    </div>
  );
}
