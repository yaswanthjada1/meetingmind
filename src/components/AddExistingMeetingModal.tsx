import React, { useState } from 'react';
import { Meeting, MeetingPlatform, RecordingMode, CalendarEvent } from '../types';
import { db } from '../db';
import {
  X,
  Calendar,
  Clock,
  Video,
  Users,
  Link,
  Mic,
  Plus,
  Radio,
  FileAudio,
  CheckCircle2,
} from 'lucide-react';

interface AddExistingMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (meetingId: string) => void;
  userId?: string;
  initialDate?: string;
}

const PLATFORMS: Array<{ id: MeetingPlatform; label: string; iconName: string }> = [
  { id: 'google_meet', label: 'Google Meet', iconName: 'Video' },
  { id: 'zoom', label: 'Zoom', iconName: 'Video' },
  { id: 'teams', label: 'Microsoft Teams', iconName: 'Video' },
  { id: 'in_person', label: 'In-person Meeting', iconName: 'Users' },
  { id: 'discord', label: 'Discord', iconName: 'Radio' },
  { id: 'phone', label: 'Phone / Voice Call', iconName: 'Mic' },
  { id: 'other', label: 'Other', iconName: 'Calendar' },
];

export const AddExistingMeetingModal: React.FC<AddExistingMeetingModalProps> = ({
  isOpen,
  onClose,
  onAdded,
  userId = 'default_user',
  initialDate,
}) => {
  const todayStr = initialDate || new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [platform, setPlatform] = useState<MeetingPlatform>('google_meet');
  const [meetingLink, setMeetingLink] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const meetingId = `m-${Date.now()}`;
      const participants = participantInput
        .split(/[,;\n]/)
        .map((p) => p.trim())
        .filter(Boolean);

      // Compute start and end times ISO
      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
      const endTimeStr = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;

      const newMeeting: Meeting = {
        id: meetingId,
        userId,
        title: title.trim(),
        date,
        startTime,
        endTime: endTimeStr,
        durationMinutes,
        platform,
        meetingLink: meetingLink.trim() || undefined,
        participants: participants.length > 0 ? participants : ['Organizer'],
        summary: '',
        importantPoints: [],
        decisions: [],
        commitments: [],
        questions: [],
        deadlines: [],
        conflicts: [],
        status: 'scheduled',
        meetingState: 'upcoming',
        recordingMode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.meetings.put(newMeeting);

      // Add to calendar events
      const calEvent: CalendarEvent = {
        id: `cal-${meetingId}`,
        userId,
        title: newMeeting.title,
        participants: newMeeting.participants,
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        sourceMeetingId: meetingId,
        platform: newMeeting.platform,
        meetingLink: newMeeting.meetingLink,
        status: 'confirmed',
        meetingState: 'upcoming',
      };

      await db.calendarEvents.put(calEvent);

      onAdded(meetingId);
      onClose();
    } catch (err) {
      console.error('Failed to add external meeting:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Add Existing Meeting</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Tell MeetingMind about a meeting happening on Google Meet, Zoom, Teams or in-person.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Meeting Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint Architecture Sync or Client Review"
              className="w-full text-xs px-3 py-2 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-500 bg-white"
            />
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Duration</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white"
              >
                <option value={15}>15 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins (1 hr)</option>
                <option value={90}>90 mins</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Platform / Location</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`text-left px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                    platform === p.id
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-2xs'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Meeting Link (Optional) */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Meeting Link <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Link className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/xyz-abc or Zoom link"
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-zinc-200 font-mono"
              />
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Participants <span className="text-zinc-400 font-normal">(Comma separated, optional)</span>
            </label>
            <input
              type="text"
              value={participantInput}
              onChange={(e) => setParticipantInput(e.target.value)}
              placeholder="e.g. Rahul, Priya, Alex"
              className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200"
            />
          </div>

          {/* Recording Mode */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Recording Preference</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer text-xs transition-colors ${
                  recordingMode === 'manual'
                    ? 'border-zinc-900 bg-zinc-50/80 text-zinc-900 font-medium'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <input
                  type="radio"
                  name="recMode"
                  checked={recordingMode === 'manual'}
                  onChange={() => setRecordingMode('manual')}
                  className="mt-0.5"
                />
                <div>
                  <div>Manual</div>
                  <div className="text-[10px] text-zinc-400 font-normal leading-tight">Start with 1 click</div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer text-xs transition-colors ${
                  recordingMode === 'automatic'
                    ? 'border-zinc-900 bg-zinc-50/80 text-zinc-900 font-medium'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <input
                  type="radio"
                  name="recMode"
                  checked={recordingMode === 'automatic'}
                  onChange={() => setRecordingMode('automatic')}
                  className="mt-0.5"
                />
                <div>
                  <div>Automatic</div>
                  <div className="text-[10px] text-zinc-400 font-normal leading-tight">Prompts at start time</div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer text-xs transition-colors ${
                  recordingMode === 'upload_later'
                    ? 'border-zinc-900 bg-zinc-50/80 text-zinc-900 font-medium'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <input
                  type="radio"
                  name="recMode"
                  checked={recordingMode === 'upload_later'}
                  onChange={() => setRecordingMode('upload_later')}
                  className="mt-0.5"
                />
                <div>
                  <div>Upload Later</div>
                  <div className="text-[10px] text-zinc-400 font-normal leading-tight">Upload audio file</div>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Indexed strictly in local memory</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="px-4 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
