import React, { useState } from 'react';
import { Meeting, MeetingPlatform } from '../types';
import { formatLocalDate, formatDisplayDate } from '../utils/dateUtils';
import { Search, Plus, Calendar, Clock, Users, ChevronRight, CheckCircle2 } from 'lucide-react';

interface MeetingsHistoryViewProps {
  meetings: Meeting[];
  onSelectMeeting: (meetingId: string) => void;
  onAddMeeting: () => void;
}

export const MeetingsHistoryView: React.FC<MeetingsHistoryViewProps> = ({
  meetings,
  onSelectMeeting,
  onAddMeeting,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = meetings.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      (m.rawNotes && m.rawNotes.toLowerCase().includes(q)) ||
      m.participants.some((p) => p.toLowerCase().includes(q))
    );
  });

  // Group by relative date label using real browser dates
  const today = new Date();
  const todayStr = formatLocalDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  const formatHeaderDate = (dateStr: string) => {
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    return formatDisplayDate(dateStr);
  };

  // Grouping
  const groups: Record<string, Meeting[]> = {};
  for (const m of filtered) {
    const label = formatHeaderDate(m.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(m);
  }

  const renderPlatformBadge = (platform?: MeetingPlatform) => {
    switch (platform) {
      case 'google_meet':
        return <span className="text-[10px] text-emerald-700 font-medium">Google Meet</span>;
      case 'zoom':
        return <span className="text-[10px] text-blue-700 font-medium">Zoom</span>;
      case 'teams':
        return <span className="text-[10px] text-indigo-700 font-medium">Teams</span>;
      case 'in_person':
        return <span className="text-[10px] text-amber-800 font-medium">In-person</span>;
      case 'discord':
        return <span className="text-[10px] text-purple-700 font-medium">Discord</span>;
      case 'phone':
        return <span className="text-[10px] text-rose-700 font-medium">Phone</span>;
      default:
        return <span className="text-[10px] text-zinc-600 font-medium">External</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 font-sans animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Meetings</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Chronological notes, recorded transcripts & decision memory
          </p>
        </div>

        <button
          onClick={onAddMeeting}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Existing Meeting</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-8">
        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search meetings by title, participants, or topics..."
          className="w-full text-xs pl-9 pr-4 py-2 rounded-md border border-zinc-200 bg-white focus:outline-hidden focus:border-zinc-400"
        />
      </div>

      {/* Grouped Chronological List */}
      <div className="space-y-6">
        {Object.keys(groups).length === 0 ? (
          <div className="border border-dashed border-zinc-300 rounded-lg p-12 text-center">
            <h3 className="text-sm font-semibold text-zinc-600 mb-1">No meetings yet</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Add your Google Meet, Zoom, Teams, or in-person sessions to begin tracking.
            </p>
            <button
              onClick={onAddMeeting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-black rounded-md shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Existing Meeting</span>
            </button>
          </div>
        ) : (
          Object.entries(groups).map(([dateLabel, groupMeetings]) => (
            <div key={dateLabel} className="space-y-2">
              <h3 className="text-xs font-semibold text-zinc-400 font-mono uppercase tracking-wider pl-1">
                {dateLabel}
              </h3>

              <div className="space-y-2">
                {groupMeetings.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => onSelectMeeting(m.id)}
                    className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-300 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-700">
                          {m.title}
                        </span>
                        <span className="text-zinc-300">•</span>
                        {renderPlatformBadge(m.platform)}
                      </div>

                      <div className="flex items-center gap-2">
                        {m.meetingState === 'completed' || m.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Processed
                          </span>
                        ) : m.meetingState === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin" />
                            Processing
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                            Upcoming
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                      {m.summary || (m.meetingState === 'completed' ? 'Processing finished.' : 'Scheduled session. Click to view intelligence or prepare recording.')}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono mt-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-300" />
                        {m.startTime || '10:00'} ({m.durationMinutes}m)
                      </span>
                      {m.participants.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-sans">
                            <Users className="w-3 h-3 text-zinc-300" />
                            {m.participants.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
