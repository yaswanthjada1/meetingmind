import React, { useState, useEffect } from 'react';
import { Meeting, MeetingPlatform, RecordingMode, CalendarEvent } from '../types';
import { db } from '../db';
import { formatLocalDate } from '../utils/dateUtils';
import {
  X,
  Calendar,
  Clock,
  Video,
  Users,
  Link,
  Mic,
  Plus,
} from 'lucide-react';

interface AddExistingMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (meetingId: string) => void;
  userId?: string;
  initialDate?: string;
}

const PLATFORMS: Array<{ id: MeetingPlatform; label: string }> = [
  { id: 'google_meet', label: 'Google Meet' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'teams', label: 'Microsoft Teams' },
  { id: 'in_person', label: 'In-person' },
  { id: 'discord', label: 'Discord' },
  { id: 'phone', label: 'Phone' },
  { id: 'other', label: 'Other' },
];

export const AddExistingMeetingModal: React.FC<AddExistingMeetingModalProps> = ({
  isOpen,
  onClose,
  onAdded,
  userId = 'default_user',
  initialDate,
}) => {
  const defaultDate = initialDate || formatLocalDate(new Date());

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [platform, setPlatform] = useState<MeetingPlatform>('google_meet');
  const [meetingLink, setMeetingLink] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
    }
  }, [initialDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setValidationError('Please enter a meeting title.');
      return;
    }

    const cleanLink = meetingLink.trim();
    if (cleanLink) {
      try {
        const parsed = new URL(cleanLink);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setValidationError('Meeting link must begin with http:// or https://');
          return;
        }
      } catch (e) {
        setValidationError('Please provide a valid URL for the meeting link.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const meetingId = `m-${Date.now()}`;
      const participants = participantInput
        .split(/[,;\n]/)
        .map((p) => p.trim())
        .filter(Boolean);

      // Compute end time based on local date components
      const [hoursStr, minsStr] = startTime.split(':');
      const startHours = parseInt(hoursStr, 10);
      const startMins = parseInt(minsStr, 10);
      const totalStartMins = startHours * 60 + startMins;
      const totalEndMins = totalStartMins + durationMinutes;

      const endHours = Math.floor(totalEndMins / 60) % 24;
      const endMinsRemainder = totalEndMins % 60;
      const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinsRemainder).padStart(2, '0')}`;

      const newMeeting: Meeting = {
        id: meetingId,
        userId,
        title: cleanTitle,
        date,
        startTime,
        endTime: endTimeStr,
        durationMinutes,
        platform,
        meetingLink: cleanLink || undefined,
        meetingUrl: cleanLink || undefined,
        participants,
        summary: '',
        importantPoints: [],
        decisions: [],
        commitments: [],
        questions: [],
        deadlines: [],
        conflicts: [],
        status: 'scheduled',
        meetingState: 'scheduled',
        recordingMode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.meetings.put(newMeeting);

      // Create matching calendar event record scoped to userId
      const calEvent: CalendarEvent = {
        id: `cal-${meetingId}`,
        userId,
        title: newMeeting.title,
        participants: newMeeting.participants,
        start: `${date}T${startTime}:00`,
        end: `${date}T${endTimeStr}:00`,
        sourceMeetingId: meetingId,
        platform: newMeeting.platform,
        meetingLink: newMeeting.meetingLink,
        status: 'confirmed',
        meetingState: 'scheduled',
      };

      await db.calendarEvents.put(calEvent);

      onAdded(meetingId);
      onClose();
    } catch (err: any) {
      setValidationError(`Failed to save meeting: ${err?.message || 'IndexedDB error'}`);
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
            <h2 className="text-sm font-semibold text-zinc-900">+ Add Existing Meeting</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Track an existing meeting happening on Google Meet, Zoom, Teams, Discord, Phone, or In-Person.
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
          {validationError && (
            <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono">
              {validationError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Product Sync"
              className="w-full text-xs px-3 py-2 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-500 bg-white"
            />
          </div>

          {/* Date, Start Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Start Time *</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Duration *</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white"
              >
                <option value={15}>15 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 mins</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Platform</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`text-center px-2 py-1.5 rounded-md text-xs font-medium border transition-colors truncate ${
                    platform === p.id
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-2xs'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Meeting Link (Optional for In-person / Phone) */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Meeting Link {platform === 'in_person' || platform === 'phone' ? (
                <span className="text-zinc-400 font-normal">(Optional)</span>
              ) : (
                <span className="text-zinc-500 font-normal">(e.g. Google Meet or Zoom URL)</span>
              )}
            </label>
            <div className="relative">
              <Link className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij"
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
              placeholder="e.g. Mentor, Team Lead"
              className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200"
            />
          </div>

          {/* Recording Mode */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Recording Mode</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  recordingMode === 'manual'
                    ? 'border-zinc-900 bg-zinc-50 text-zinc-900 font-medium'
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
                  <div>Manual Capture</div>
                  <div className="text-[10px] text-zinc-400 font-normal leading-tight">Start with 1 click when meeting begins</div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  recordingMode === 'automatic'
                    ? 'border-zinc-900 bg-zinc-50 text-zinc-900 font-medium'
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
                  <div>Prepare Automatically</div>
                  <div className="text-[10px] text-zinc-400 font-normal leading-tight">Prompt to enable capture before start</div>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400">Stored locally in IndexedDB</span>
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
                {isSubmitting ? 'Saving...' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
