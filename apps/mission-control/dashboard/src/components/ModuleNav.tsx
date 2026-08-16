import { NavLink } from 'react-router-dom';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function ModuleNav(props: { items: Array<{ to: string; label: string; end?: boolean }> }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-2">
      {props.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cx(
              'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold border transition',
              isActive
                ? 'bg-sky-400/15 text-sky-100 border-sky-400/30'
                : 'text-white/55 hover:text-white/85 hover:bg-white/5 border-transparent'
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
