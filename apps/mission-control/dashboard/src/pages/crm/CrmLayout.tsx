import { Outlet } from 'react-router-dom';
import { ModuleNav } from '../../components/ModuleNav';
import QuickActionsBar from '../../components/QuickActionsBar';
import CreateRecordModal from './CreateRecordModal';
import { CrmProvider, useCrm } from './CrmContext';
import RecordDetailPanel from './RecordDetailPanel';

const CRM_NAV = [
  { to: '/crm', label: 'Home', end: true },
  { to: '/crm/customers', label: 'Customers' },
  { to: '/crm/opportunities', label: 'Opportunities' },
  { to: '/solar/leads', label: 'Leads' },
  { to: '/crm/feed', label: 'Feed' },
  { to: '/crm/tasks', label: 'Tasks' },
  { to: '/crm/analytics', label: 'Analytics' },
  { to: '/crm/settings', label: 'Settings' },
];

function CrmModule() {
  const crm = useCrm();

  return (
    <div className="space-y-4 sm:space-y-6">
      <ModuleNav items={CRM_NAV} />
      <Outlet />
      <QuickActionsBar
        contacts={crm.contacts}
        selectedContactId={crm.selectedContactId}
        onSelectContact={crm.setSelectedContactId}
        selectedPersonId={crm.selectedPersonId}
        selectedContact={crm.selectedContact}
      />
      <RecordDetailPanel record={crm.detailRecord} onClose={crm.closeDetail} />
      {crm.createType && (
        <CreateRecordModal entityType={crm.createType} onClose={crm.closeCreate} onCreated={() => crm.loadCrm()} />
      )}
    </div>
  );
}

export default function CrmLayout() {
  return (
    <CrmProvider>
      <CrmModule />
    </CrmProvider>
  );
}
