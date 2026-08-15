import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthChanged } from './lib/auth';

import Login from './pages/Login';
import HhsHome from './pages/HhsHome';
import CrmPage from './pages/CrmPage';
import CrmPersonTimelinePage from './pages/CrmPersonTimelinePage';
import CrmTaskReviewQueuePage from './pages/CrmTaskReviewQueuePage';
import AgentConsolePage from './pages/AgentConsolePage';
import MissionControlPage from './pages/MissionControlPage';
import { AppShell } from './layouts/AppShell';
import SolarShell from './pages/solar/SolarShell';
import SolarOverview from './pages/solar/SolarOverview';
import SolarLeads from './pages/solar/SolarLeads';
import SolarActivity from './pages/solar/SolarActivity';
import SolarReview from './pages/solar/SolarReview';
import SolarFlows from './pages/solar/SolarFlows';
import SolarDoctrine from './pages/solar/SolarDoctrine';
import SolarSettings from './pages/solar/SolarSettings';
import SolarLeadDetail from './pages/solar/SolarLeadDetail';
import SystemStatusPage from './pages/system/SystemStatusPage';
import ReviewQueuePage from './pages/system/ReviewQueuePage';
import RunsPage from './pages/system/RunsPage';
import ActivityPage from './pages/system/ActivityPage';
import FlowsPage from './pages/system/FlowsPage';
import ToolsPage from './pages/system/ToolsPage';
import AgentContextPage from './pages/AgentContextPage';
import OpenClawControlPage from './pages/system/OpenClawControlPage';
import Settings from './pages/Settings';

function AppRoutes() {
  const location = useLocation();
  const [session, setSession] = useState<string | null>(() => localStorage.getItem('session'));

  useEffect(() => {
    const syncSession = () => setSession(localStorage.getItem('session'));
    const unsubscribe = onAuthChanged(syncSession);
    syncSession();
    return () => {
      unsubscribe();
    };
  }, []);

  if (location.pathname === '/login') {
    return session ? <Navigate to="/" replace /> : <Login />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HhsHome />} />
        <Route path="/mission-control" element={<MissionControlPage />} />
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/crm/tasks" element={<CrmTaskReviewQueuePage />} />
        <Route path="/crm/people/:personId/timeline" element={<CrmPersonTimelinePage />} />
        <Route path="/agents" element={<AgentConsolePage />} />

        <Route path="/solar" element={<SolarShell />}>
          <Route index element={<SolarOverview />} />
          <Route path="leads" element={<SolarLeads />} />
          <Route path="leads/:leadId" element={<SolarLeadDetail />} />
          <Route path="activity" element={<SolarActivity />} />
          <Route path="review" element={<SolarReview />} />
          <Route path="flows" element={<SolarFlows />} />
          <Route path="doctrine" element={<SolarDoctrine />} />
          <Route path="settings" element={<SolarSettings />} />
        </Route>

        <Route path="/system/context" element={<AgentContextPage />} />
        <Route path="/system/status" element={<SystemStatusPage />} />
        <Route path="/system/review" element={<ReviewQueuePage />} />
        <Route path="/system/activity" element={<ActivityPage />} />
        <Route path="/system/flows" element={<FlowsPage />} />
        <Route path="/system/runs" element={<RunsPage />} />
        <Route path="/system/tools" element={<ToolsPage />} />
        <Route path="/openclaw" element={<OpenClawControlPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
