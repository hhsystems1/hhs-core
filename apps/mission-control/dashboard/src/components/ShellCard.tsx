import type { ReactNode } from 'react';

export function ShellCard(props: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{props.title}</div>
          {props.subtitle && <div className="mt-1 text-sm text-white/60">{props.subtitle}</div>}
        </div>
        {props.right}
      </div>
      <div className="mt-5">{props.children}</div>
    </section>
  );
}
