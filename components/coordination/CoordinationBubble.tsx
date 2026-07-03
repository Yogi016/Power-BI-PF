import React, { useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHelpRequests, invalidateHelpRequestsCache } from '../../hooks/useHelpRequests';
import { CoordinationPanel } from './CoordinationPanel';

// Bottom-LEFT so it never overlaps the Danta.AI bubble (bottom-right).
export const CoordinationBubble: React.FC = () => {
  const { user } = useAuth();
  const { unreadCount } = useHelpRequests();
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user) return null;

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <>
      {open && (
        <CoordinationPanel
          key={refreshKey}
          currentUserId={user.id}
          onClose={() => setOpen(false)}
          onMutated={bump}
        />
      )}
      <button
        onClick={() => { if (!open) invalidateHelpRequestsCache(); setOpen((o) => !o); }}
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0066cc] text-white shadow-lg transition hover:bg-[#0055b3] active:scale-[0.98]"
        aria-label="Pusat Koordinasi"
      >
        <MessagesSquare size={22} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>
    </>
  );
};
