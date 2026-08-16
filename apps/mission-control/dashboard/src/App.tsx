import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthChanged } from './lib/auth';

import Login from './pages/Login';
import MissionControlHome from './pages/MissionControlHome';
import CrmPersonTimelinePage from './pages/CrmPersonTimelinePage';
import AgentConsolePage from './pages/AgentConsolePage';
import { AppShell } from './layouts/AppShell';

import CrmLayout from './pages/crm/CrmLayout';
import CrmHome from './pages/crm/CrmHome';
import CrmCustomers from './pages/crm/CrmCustomers';
import CrmOpportunities from './pages/crm/CrmOpportunities';
import CrmFeed from './pages/crm/CrmFeed';
import CrmTasksPage from './pages/crm/CrmTasksPage';
import CrmAnalytics from './pages/crm/CrmAnalytics';
import CrmSettings from './pages/crm/CrmSettings';

import AgentsLayout from './pages/agents/AgentsLayout';
import WorkflowCanvas from './pages/agents/WorkflowCanvas';
import AgentJobDetailPage from './pages/agents/AgentJobDetailPage';
import AgentBoardPage from './pages/AgentBoardPage';

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
        <Route path="/" element={<MissionControlHome />} />
        <Route path="/mission-control" element={<Navigate to="/" replace />} />
        <Route path="/chat" element={<AgentConsolePage />} />

        <Route path="/crm" element={<CrmLayout />}>
          <Route index element={<CrmHome />} />
          <Route path="customers" element={<CrmCustomers />} />
          <Route path="opportunities" element={<CrmOpportunities />} />
          <Route path="leads" element={<Navigate to="/solar/leads" replace />} />
          <Route path="feed" element={<CrmFeed />} />
          <Route path="tasks" element={<CrmTasksPage />} />
          <Route path="analytics" element={<CrmAnalytics />} />
          <Route path="settings" element={<CrmSettings />} />
          <Route path="people/:personId/timeline" element={<CrmPersonTimelinePage />} />
        </Route>

        <Route path="/agents" element={<AgentsLayout />}>
          <Route index element={<WorkflowCanvas />} />
          <Route path="board" element={<AgentBoardPage />} />
          <Route path="runs" element={<RunsPage title="Run Log" subtitle="Source: /api/runs" />} />
          <Route path="flows" element={<FlowsPage title="Flow View" subtitle="Grouped by root_run_id" />} />
          <Route path="jobs/:jobId" element={<AgentJobDetailPage />} />
        </Route>

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
