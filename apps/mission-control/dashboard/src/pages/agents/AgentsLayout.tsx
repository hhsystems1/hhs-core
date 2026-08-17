import { Outlet } from 'react-router-dom';
import { ModuleNav } from '../../components/ModuleNav';

const AGENTS_NAV = [
  { to: '/agents', label: 'Designer', end: true },
  { to: '/agents/canvas', label: 'Monitor' },
  { to: '/agents/board', label: 'Job Board' },
  { to: '/agents/runs', label: 'Runs' },
  { to: '/agents/flows', label: 'Flows' },
];

export default function AgentsLayout() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <ModuleNav items={AGENTS_NAV} />
      <Outlet />
    </div>
  );
}
