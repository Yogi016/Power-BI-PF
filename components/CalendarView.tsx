import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as BigCalendar, momentLocalizer, View, SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/id';
import { CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CalendarDays } from 'lucide-react';
import { YearView } from './YearView';

moment.locale('id');
const localizer = momentLocalizer(moment);

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (event: CalendarEvent, start: Date, end: Date) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  defaultView?: View;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  onEventClick,
  onEventDrop,
  onSelectSlot,
  defaultView = 'month',
}) => {
  const [view, setView] = useState<View>(defaultView);
  const [date, setDate] = useState(new Date());
  const [showYearView, setShowYearView] = useState(false);

  // Event style getter based on status
  const eventStyleGetter = (event: CalendarEvent) => {
    const statusColors: Record<string, string> = {
      'not-started': '#94a3b8',
      'in-progress': '#3b82f6',
      'completed': '#10b981',
      'delayed': '#ef4444',
      'on-hold': '#f59e0b',
    };

    const backgroundColor = statusColors[event.resource.status] || '#64748b';

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block',
      },
      className: `status-${event.resource.status}`,
    };
  };

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => (
    <div className="flex items-center gap-1 overflow-hidden">
      <span className="font-medium truncate">{event.title}</span>
    </div>
  );

  // Handle event drop (drag and drop)
  const handleEventDrop = ({ event, start, end }: any) => {
    onEventDrop(event, start, end);
  };

  // Navigate to today
  const handleToday = () => {
    setDate(new Date());
  };

  // Navigate to previous period
  const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') {
      setDate(new Date());
    } else if (action === 'PREV') {
      setDate(moment(date).subtract(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate());
    } else {
      setDate(moment(date).add(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate());
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Custom Toolbar */}
      <div className="bg-gradient-to-r from-blue-600 to-emerald-600 p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowYearView(!showYearView)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              showYearView
                ? 'bg-white text-blue-600 shadow-lg'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <CalendarDays size={18} />
              <span className="hidden sm:inline">Year</span>
            </div>
          </button>
          
          {!showYearView && (
            <>
              <button
                onClick={() => setView('month')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  view === 'month'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  view === 'week'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView('day')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  view === 'day'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                Day
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (showYearView) {
                setDate(new Date(date.getFullYear() - 1, 0, 1));
              } else {
                const newDate = moment(date).subtract(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate();
                setDate(newDate);
              }
            }}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={() => setDate(new Date())}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-all"
          >
            {showYearView ? date.getFullYear() : 'Today'}
          </button>

          <button
            onClick={() => {
              if (showYearView) {
                setDate(new Date(date.getFullYear() + 1, 0, 1));
              } else {
                const newDate = moment(date).add(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate();
                setDate(newDate);
              }
            }}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-auto p-4">
        {showYearView ? (
          <YearView
            year={date.getFullYear()}
            events={events}
            onEventClick={onEventClick}
            onDateClick={(clickedDate) => {
              setDate(clickedDate);
              setShowYearView(false);
              setView('day');
            }}
          />
        ) : (
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            onSelectEvent={onEventClick}
            onSelectSlot={onSelectSlot}
            onEventDrop={handleEventDrop}
            eventPropGetter={eventStyleGetter}
            components={{
              event: EventComponent,
              toolbar: () => null, // Hide default toolbar
            }}
            selectable
            resizable
            popup
            style={{ height: '100%', minHeight: 600 }}
            messages={{
              today: 'Hari Ini',
              previous: 'Sebelumnya',
              next: 'Selanjutnya',
              month: 'Bulan',
              week: 'Minggu',
              day: 'Hari',
              agenda: 'Agenda',
              date: 'Tanggal',
              time: 'Waktu',
              event: 'Kegiatan',
              noEventsInRange: 'Tidak ada kegiatan dalam periode ini',
              showMore: (total) => `+${total} lainnya`,
            }}
          />
        )}
      </div>
    </div>
  );
};
