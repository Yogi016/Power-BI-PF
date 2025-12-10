import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarEvent } from '../types';

interface YearViewProps {
  year: number;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

export const YearView: React.FC<YearViewProps> = ({ year, events, onEventClick, onDateClick }) => {
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return date >= eventStart && date <= eventEnd;
    });
  };

  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get first day of month to calculate offset
    const firstDayOfWeek = monthStart.getDay();
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday = 0

    return (
      <div key={monthDate.getMonth()} className="bg-white rounded-lg shadow-md p-3 border border-slate-200">
        {/* Month Header */}
        <div className="text-center mb-2 pb-2 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-800">
            {format(monthDate, 'MMMM yyyy', { locale: localeId })}
          </h3>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-slate-600 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`offset-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {days.map(day => {
            const dayEvents = getEventsForDate(day);
            const isCurrentDay = isToday(day);
            const isCurrentMonth = isSameMonth(day, monthDate);

            return (
              <div
                key={day.toISOString()}
                onClick={() => onDateClick?.(day)}
                className={`
                  aspect-square p-1 rounded cursor-pointer transition-all
                  ${isCurrentDay ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-slate-50'}
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                `}
              >
                <div className="h-full flex flex-col">
                  <div className={`text-xs text-center ${isCurrentDay ? 'font-bold text-blue-700' : 'text-slate-700'}`}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Event indicators */}
                  {dayEvents.length > 0 && (
                    <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                      {dayEvents.slice(0, 2).map((event, idx) => {
                        const statusColors: Record<string, string> = {
                          'not-started': 'bg-slate-400',
                          'in-progress': 'bg-blue-500',
                          'completed': 'bg-green-500',
                          'delayed': 'bg-red-500',
                          'on-hold': 'bg-orange-500',
                        };
                        const bgColor = statusColors[event.resource.status] || 'bg-slate-400';

                        return (
                          <div
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                            className={`${bgColor} rounded-sm h-1 w-full cursor-pointer hover:opacity-80 transition-opacity`}
                            title={event.title}
                          />
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[8px] text-slate-500 text-center">
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Year Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800">{year}</h2>
      </div>

      {/* 12 Month Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {months.map(renderMonth)}
      </div>
    </div>
  );
};
