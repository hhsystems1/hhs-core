import { WorkspaceShell } from '../../layouts/WorkspaceShell';

export default function SolarShell() {
  const basePath = '/solar';
  const nav = [
    { to: '/solar', label: 'Overview' },
    { to: '/solar/leads', label: 'Leads' },
    { to: '/solar/activity', label: 'Activity' },
    { to: '/solar/review', label: 'Review' },
    { to: '/solar/flows', label: 'Flows' },
    { to: '/solar/doctrine', label: 'Doctrine' },
    { to: '/solar/settings', label: 'Settings' },
  ];

  return <WorkspaceShell workspaceLabel="Solar" basePath={basePath} nav={nav} />;
}
