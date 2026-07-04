import React, { useState } from 'react';
import { MessagesSquare, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHelpRequests, invalidateHelpRequestsCache } from '../../hooks/useHelpRequests';
import { CoordinationPanel } from './CoordinationPanel';

// Takes the launcher slot vacated by Danta.AI: a full-width card above the
// mobile nav, and an Action-Blue button at bottom-right on desktop. The launcher
// hides while the panel is open (the panel carries its own close button).
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
      {!open && (
        <div className="fixed inset-x-3 bottom-[5.35rem] z-[70] sm:inset-auto sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={() => { invalidateHelpRequestsCache(); setOpen(true); }}
            className="group relative mx-auto flex h-11 w-full max-w-md items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white/95 px-2.5 text-left text-slate-600 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur-xl transition hover:border-blue-200 hover:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 sm:mx-0 sm:h-14 sm:w-auto sm:justify-center sm:gap-2 sm:rounded-lg sm:border-0 sm:bg-[#0066cc] sm:px-4 sm:text-white sm:shadow-xl sm:backdrop-blur-none sm:hover:bg-[#0055b3] sm:focus:ring-blue-200"
            aria-label="Buka Chat JS"
            title="Chat JS"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#0066cc] ring-1 ring-blue-100 transition group-hover:bg-blue-100 sm:h-auto sm:w-auto sm:bg-transparent sm:text-white sm:ring-0 sm:group-hover:bg-transparent">
              <MessagesSquare size={19} />
            </span>
            <span className="min-w-0 flex-1 sm:flex-none">
              <span className="block truncate text-[13px] font-bold leading-tight text-slate-800 sm:hidden">Chat JS</span>
              <span className="hidden text-sm font-black tracking-normal sm:block">Chat JS</span>
              <span className="block truncate text-[10px] font-medium leading-tight text-slate-400 sm:hidden">Minta bantuan &amp; koordinasi tim</span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#0066cc] text-white shadow-sm transition group-hover:bg-[#0055b3] sm:hidden">
              <ChevronUp size={15} />
            </span>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-xs font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
};
