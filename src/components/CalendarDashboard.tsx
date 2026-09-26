import React, { useState } from 'react';
import { Meeting, CalendarEvent, MeetingPlatform, MeetingLifecycleState } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  Users,
  Mic,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Radio,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface CalendarDashboardProps {
  meetings: Meeting[];
  calendarEvents: CalendarEvent[];
  onSelectMeeting: (meetingId: string) => void;
  onAddExistingMeeting: (dateStr?: string) => void;
}

export const CalendarDashboard: React.FC<CalendarDashboardProps> = ({
  meetings,
  calendarEvents,
  onSelectMeeting,
  onAddExistingMeeting,
}) => {
  // Current view anchor date (defaults to current real date)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayDate, setSelectedDayDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];

  // Calendar Math: Month Grid Calculation (Sun - Sat)
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // First day of current month
  const firstDayOfMonth = new Date(year, month, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)

  // Total days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Days in previous month
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build grid days (usually 35 or 42 cells)
  interface CalendarCell {
    date: Date;
    dateStr: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
  }

  const cells: CalendarCell[] = [];

  // 1. Previous month leading days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    const dateStr = d.toISOString().split('T')[0];
    cells.push({
      date: d,
      dateStr,
      dayNumber: daysInPrevMonth - i,
      isCurrentMonth: false,
      isToday: dateStr === todayDateStr,
    });
  }

  // 2. Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateStr = d.toISOString().split('T')[0];
    cells.push({
      date: d,
      dateStr,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateStr === todayDateStr,
    });
  }

  // 3. Next month trailing days to complete full grid (multiples of 7)
  const remainingCells = 7 - (cells.length % 7);
  if (remainingCells < 7) {
    for (let day = 1; day <= remainingCells; day++) {
      const d = new Date(year, month + 1, day);
      const dateStr = d.toISOString().split('T')[0];
      cells.push({
        date: d,
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayDateStr,
      });
    }
  }

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDayDate(todayDateStr);
  };

  // Header Title: e.g. "September 2026"
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const headerTitle = `${monthName} ${year}`;

  const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Map meetings & calendar events by date string
  const getEventsForDate = (dateStr: string) => {
    const dayMeetings = meetings.filter((m) => m.date === dateStr);
    return dayMeetings;
  };

  const selectedDayMeetings = getEventsForDate(selectedDayDate);

  // Platform icon helper (monochrome)
  const renderPlatformBadge = (platform?: MeetingPlatform) => {
    switch (platform) {
      case 'google_meet':
        return <span className="text-[10px] text-black font-mono font-medium border border-zinc-200 bg-white px-1 rounded">Meet</span>;
      case 'zoom':
        return <span className="text-[10px] text-black font-mono font-medium border border-zinc-200 bg-white px-1 rounded">Zoom</span>;
      case 'teams':
        return <span className="text-[10px] text-black font-mono font-medium border border-zinc-200 bg-white px-1 rounded">Teams</span>;
      case 'in_person':
        return <span className="text-[10px] text-black font-mono font-medium border border-zinc-200 bg-white px-1 rounded">In-person</span>;
      case 'discord':
        return <span className="text-[10px] text-black font-mono font-medium border border-zinc-200 bg-white px-1 rounded">Discord</span>;
      case 'phone':
        return <span className="text-[10px] text-black font-mono font-medium border border-zinc-200 bg-white px-1 rounded">Phone</span>;
      default:
        return <span className="text-[10px] text-zinc-600 font-mono font-medium border border-zinc-200 bg-white px-1 rounded">External</span>;
    }
  };

  // State indicator helper (monochrome)
  const renderStatePill = (m: Meeting) => {
    const state = m.meetingState || (m.status === 'completed' ? 'completed' : 'upcoming');
    if (state === 'recording') {
      return (
        <span className="flex items-center gap-1 text-[9px] font-mono text-white bg-black px-1.5 py-0.5 rounded animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          Recording
        </span>
      );
    }
    if (state === 'processing') {
      return (
        <span className="flex items-center gap-1 text-[9px] font-mono text-black bg-zinc-100 border border-black px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-black animate-spin" />
          Processing
        </span>
      );
    }
    if (state === 'completed') {
      return (
        <span className="flex items-center gap-1 text-[9px] font-mono text-white bg-black px-1.5 py-0.5 rounded">
          <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          Processed
        </span>
      );
    }
    if (state === 'no_recording') {
      return (
        <span className="text-[9px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
          No recording
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono text-black bg-zinc-100 border border-zinc-300 px-1.5 py-0.5 rounded">
        Upcoming
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 font-sans animate-in fade-in duration-150">
      {/* Google Calendar Style Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight min-w-[200px]">
            {headerTitle}
          </h1>

          <div className="flex items-center border border-zinc-200 bg-white rounded-md shadow-2xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-l-md transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 border-x border-zinc-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-r-md transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onAddExistingMeeting(todayDateStr)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Existing Meeting</span>
          </button>
        </div>
      </div>

      {/* Main Month Grid */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
        {/* Day-of-week Headers */}
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/70 text-center text-xs font-medium text-zinc-500 py-2.5">
          {weekDayNames.map((d, idx) => (
            <div key={idx} className="tracking-wide uppercase text-[11px] font-mono">
              {d}
            </div>
          ))}
        </div>

        {/* Month Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200/80 bg-zinc-100/30">
          {cells.map((cell, idx) => {
            const dayEvents = getEventsForDate(cell.dateStr);
            const isSelected = selectedDayDate === cell.dateStr;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDayDate(cell.dateStr)}
                className={`min-h-[105px] sm:min-h-[120px] p-1.5 sm:p-2 transition-colors flex flex-col justify-between cursor-pointer ${
                  cell.isCurrentMonth ? 'bg-white hover:bg-zinc-50/70' : 'bg-zinc-50/40 text-zinc-400'
                } ${isSelected ? 'ring-1 ring-inset ring-zinc-900/30' : ''}`}
              >
                {/* Date header */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-mono font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      cell.isToday
                        ? 'bg-zinc-900 text-white font-semibold'
                        : cell.isCurrentMonth
                        ? 'text-zinc-800'
                        : 'text-zinc-400'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-mono text-zinc-400">
                      {dayEvents.length} {dayEvents.length === 1 ? 'meeting' : 'meetings'}
                    </span>
                  )}
                </div>

                {/* Day's Meetings list inside cell */}
                <div className="space-y-1 flex-1 overflow-hidden">
                  {dayEvents.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMeeting(m.id);
                      }}
                      className="group bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 hover:border-zinc-300 rounded p-1.5 text-left transition-all cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-1 leading-none mb-1">
                        <span className="text-[10px] font-mono text-zinc-500 font-medium">
                          {m.startTime || '10:00'}
                        </span>
                        {renderPlatformBadge(m.platform)}
                      </div>
                      <div className="text-[11px] font-semibold text-zinc-900 truncate leading-tight group-hover:text-zinc-700">
                        {m.title}
                      </div>
                    </div>
                  ))}

                  {dayEvents.length > 3 && (
                    <div className="text-[10px] font-mono text-zinc-500 pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda / Meeting Details Drawer for Mobile or Quick View */}
      <div className="mt-6 bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Schedule for {new Date(selectedDayDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {selectedDayMeetings.length === 0
                ? 'No external meetings scheduled for this date.'
                : `${selectedDayMeetings.length} meeting(s) recorded.`}
            </p>
          </div>

          <button
            onClick={() => onAddExistingMeeting(selectedDayDate)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-md transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add meeting on this date</span>
          </button>
        </div>

        {selectedDayMeetings.length === 0 ? (
          <div className="border border-dashed border-zinc-200 rounded-lg p-8 text-center text-xs text-zinc-400">
            <CalendarIcon className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
            No external meetings registered for this date.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedDayMeetings.map((m) => (
              <div
                key={m.id}
                onClick={() => onSelectMeeting(m.id)}
                className="bg-zinc-50/60 hover:bg-zinc-100/80 border border-zinc-200 rounded-lg p-4 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-zinc-700">
                      {m.startTime || '10:00'} – {m.endTime || '10:45'}
                    </span>
                    <span className="text-zinc-300">•</span>
                    {renderPlatformBadge(m.platform)}
                  </div>
                  {renderStatePill(m)}
                </div>

                <h4 className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-700 mb-1">
                  {m.title}
                </h4>

                <p className="text-[11px] text-zinc-500 line-clamp-2">
                  {m.summary || (m.meetingState === 'completed' ? 'Processing finished.' : 'Scheduled session. Click to view intelligence or prepare recording.')}
                </p>

                {m.participants.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                    <Users className="w-3 h-3" />
                    <span>{m.participants.join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
