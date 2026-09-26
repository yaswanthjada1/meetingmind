import React, { useState } from 'react';
import { Meeting } from '../types';
import {
  Calendar,
  Clock,
  Users,
  Plus,
  Mic,
  ChevronRight,
  FileText,
  CheckCircle,
  AlertCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { MeetingDetail } from './MeetingDetail';
import { MeetingRecorderModal } from './MeetingRecorderModal';
import { db } from '../db';
import { indexMeetingMemories } from '../services/memory';

interface MeetingsViewProps {
  meetings: Meeting[];
  selectedMeetingId: string | null;
  onSelectMeeting: (id: string | null) => void;
  onRefresh: () => void;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  onRefresh,
}) => {
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newParticipants, setNewParticipants] = useState('Yaswanth, Rahul');
  const [newNotes, setNewNotes] = useState('');

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);

  const handleUpdateMeeting = async (updated: Meeting) => {
    await db.meetings.put(updated);
    await indexMeetingMemories(updated);
    onRefresh();
  };

  const handleCreateEmptyNote = async () => {
    if (!newTitle.trim()) return;
    const meetingId = `meet-${Date.now()}`;
    const pList = newParticipants.split(',').map((p) => p.trim()).filter(Boolean);

    const m: Meeting = {
      id: meetingId,
      title: newTitle.trim(),
      date: new Date().toISOString().split('T')[0],
      durationMinutes: 30,
      participants: pList.length > 0 ? pList : ['Yaswanth'],
      summary: 'New meeting note created in local notepad.',
      importantPoints: [],
      decisions: [],
      commitments: [],
      questions: [],
      deadlines: [],
      conflicts: [],
      rawNotes: newNotes || '',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.meetings.put(m);
    await indexMeetingMemories(m);
    setIsCreatingNew(false);
    setNewTitle('');
    setNewNotes('');
    onRefresh();
    onSelectMeeting(m.id);
  };

  if (selectedMeeting) {
    return (
      <MeetingDetail
        meeting={selectedMeeting}
        onBack={() => onSelectMeeting(null)}
        onUpdate={handleUpdateMeeting}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-in fade-in duration-200">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-stone-200/80">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-stone-900 tracking-tight">
            Meeting Notes & History
          </h1>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Indexed locally in IndexedDB • Memory persistent across sessions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreatingNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-md transition-all shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>

          <button
            onClick={() => setIsRecorderOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-black text-white hover:bg-zinc-800 rounded-md transition-all shadow-xs"
          >
            <Mic className="w-3.5 h-3.5 text-white" />
            <span>Record Meeting</span>
          </button>
        </div>
      </div>

      {/* New Quick Note Form */}
      {isCreatingNew && (
        <div className="paper-sheet rounded-xl p-6 mb-8 border border-stone-300 animate-in slide-in-from-top-2 duration-150">
          <h3 className="font-serif font-semibold text-base text-stone-900 mb-3">Create New Meeting Note</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-stone-500 mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Infrastructure Sync"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-stone-500 mb-1">Participants</label>
              <input
                type="text"
                value={newParticipants}
                onChange={(e) => setNewParticipants(e.target.value)}
                placeholder="Yaswanth, Rahul, Priya"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-mono uppercase text-stone-500 mb-1">Initial Notes</label>
            <textarea
              rows={3}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Type rough notes here..."
              className="w-full text-xs font-mono p-3 rounded-lg border border-stone-200"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsCreatingNew(false)}
              className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateEmptyNote}
              className="px-3.5 py-1.5 text-xs font-medium bg-stone-900 text-stone-50 rounded-md"
            >
              Save Note
            </button>
          </div>
        </div>
      )}

      {/* Meetings List */}
      {meetings.length === 0 ? (
        <div className="paper-sheet rounded-xl p-12 text-center text-stone-500">
          <BookOpen className="w-8 h-8 text-stone-400 mx-auto mb-3" />
          <p className="font-serif text-base text-stone-800 font-medium">No meeting notes recorded yet</p>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Click "Demo Workspace" in the header to load previous architecture meetings or record a new session.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              onClick={() => onSelectMeeting(meeting.id)}
              className="paper-sheet rounded-xl p-5 hover:border-stone-400/80 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-semibold text-stone-900 group-hover:text-black transition-colors">
                    {meeting.title}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-stone-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{meeting.date}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{meeting.durationMinutes}m</span>
                  </div>
                </div>
              </div>

              {/* Summary snippet */}
              <p className="text-xs text-stone-600 line-clamp-2 mb-3 font-sans leading-relaxed">
                {meeting.summary || meeting.rawNotes || 'Click to view structured notepad.'}
              </p>

              {/* Bottom tags & metrics */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-100 text-xs">
                {/* Participants */}
                <div className="flex items-center gap-1 text-stone-500">
                  <Users className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-[11px]">{meeting.participants.join(', ')}</span>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  {meeting.decisions && meeting.decisions.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-black border border-zinc-300">
                      {meeting.decisions.length} {meeting.decisions.length === 1 ? 'decision' : 'decisions'}
                    </span>
                  )}
                  {meeting.commitments && meeting.commitments.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-black border border-zinc-300">
                      {meeting.commitments.length} {meeting.commitments.length === 1 ? 'commitment' : 'commitments'}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recording Modal */}
      <MeetingRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onMeetingSaved={(m) => {
          onRefresh();
          onSelectMeeting(m.id);
        }}
      />
    </div>
  );
};
