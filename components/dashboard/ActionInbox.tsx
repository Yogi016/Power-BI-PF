import React from 'react';
import type { UserRole } from '../../types';
import { useCooperationDocuments } from '../../hooks/useCooperationDocuments';
import { buildRoleDocumentInbox, getRoleDashboardConfig, getCooperationStatusLabel } from '../../lib/cooperationWorkflow';
import { Card, StatusBadge } from '../ui';

export const ActionInbox: React.FC<{ role: UserRole }> = ({ role }) => {
  const { documents, loading, error } = useCooperationDocuments();
  const config = getRoleDashboardConfig(role);
  const items = buildRoleDocumentInbox(documents, role);

  return (
    <Card title={config.inboxTitle}>
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      )}
      {!loading && error && (
        <p className="text-sm text-red-600">Gagal memuat dokumen: {error}</p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-500">{config.emptyText}</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {items.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{doc.title}</p>
                <p className="truncate text-xs text-slate-500">{doc.partnerName}</p>
              </div>
              <StatusBadge status="warning" label={getCooperationStatusLabel(doc.status)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
