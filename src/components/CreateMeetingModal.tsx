import React, { useState } from 'react';
import { Meeting, RecordingMode } from '../types';
import { db } from '../db';
import { indexMeetingMemories } from '../services/memory';
import { createCalendarEvent } from '../services/calendar';
import { X, Calendar, Clock, Users, Play, Mic } from 'lucide-react';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (meetingId: string) => void;
  onStartNow?: (meetingId: string) => void;
  userId?: string;
}

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onStartNow,
  userId = '',
}) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState(nowTimeStr);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [participantsText, setParticipantsText] = useState('');
  const [initialNotes, setInitialNotes] = useState('');
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('automatic');

  if (!isOpen) return null;

  const createMeeting = async (startNow: boolean): Promise<string | null> => {
    if (!title.trim() || !userId) return null;

    const pList = participantsText
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const meetingId = `meet-${Date.now()}`;
    const startHour = parseInt(startTime.split(':')[0], 10);
    const startMin = parseInt(startTime.split(':')[1], 10) || 0;
    const endMinutes = startMin + durationMinutes;
    const endHour = startHour + Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    const newMeeting: Meeting = {
      id: meetingId,
      userId,
      title: title.trim(),
      date: startNow ? todayStr : date,
      startTime: startNow ? nowTimeStr : startTime,
      endTime,
      durationMinutes,
      participants: pList,
      summary: initialNotes ? `Scheduled: ${initialNotes}` : '',
      importantPoints: [],
      decisions: [],
      commitments: [],
      questions: [],
      deadlines: [],
      conflicts: [],
      rawNotes: initialNotes,
      status: startNow ? 'in-progress' : 'scheduled',
      meetingState: startNow ? 'starting' : 'scheduled',
      recordingMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.meetings.put(newMeeting);

    // Add to calendar events
    const meetingDate = startNow ? todayStr : date;
    const meetingTime = startNow ? nowTimeStr : startTime;
    const startIso = `${meetingDate}T${meetingTime}:00`;
    const endIso = `${meetingDate}T${endTime}:00`;
    await createCalendarEvent(title.trim(), pList, startIso, endIso, userId);

    return meetingId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const meetingId = await createMeeting(false);
    if (meetingId) {
      resetForm();
      onCreated(meetingId);
    }
  };

  const handleStartNow = async () => {
    const meetingId = await createMeeting(true);
    if (meetingId) {
      resetForm();
      onClose();
      if (onStartNow) {
        onStartNow(meetingId);
      } else {
        onCreated(meetingId);
      }
    }
  };

  const resetForm = () => {
    setTitle('');
    setParticipantsText('');
    setInitialNotes('');
    setDurationMinutes(30);
    setRecordingMode('automatic');
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-semibold text-zinc-900 mb-4">Create Meeting</h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Architecture Discussion"
              className="w-full text-xs px-3 py-2 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-400"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-zinc-200 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
                Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-zinc-200 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-zinc-200 font-mono bg-white"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
              Participants (comma-separated)
            </label>
            <input
              type="text"
              value={participantsText}
              onChange={(e) => setParticipantsText(e.target.value)}
              placeholder="e.g. Rahul, Priya"
              className="w-full text-xs px-3 py-2 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-400"
            />
          </div>

          {/* Recording Mode */}
          <div>
            <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-2">
              Recording
            </label>
            <div className="flex items-center gap-4 text-xs text-zinc-700">
              {(['automatic', 'manual', 'disabled'] as RecordingMode[]).map((mode) => (
                <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="recordingMode"
                    value={mode}
                    checked={recordingMode === mode}
                    onChange={() => setRecordingMode(mode)}
                    className="accent-zinc-900"
                  />
                  <span className="capitalize">{mode}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
              Agenda / Notes (optional)
            </label>
            <textarea
              rows={3}
              value={initialNotes}
              onChange={(e) => setInitialNotes(e.target.value)}
              placeholder="Topics to discuss..."
              className="w-full text-xs font-mono p-2.5 rounded-md border border-zinc-200"
            />
          </div>

          <div className="flex flex-col gap-2 pt-3 border-t border-zinc-100">
            {/* Start Now — primary action for testing */}
            <button
              type="button"
              onClick={handleStartNow}
              disabled={!title.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium bg-zinc-900 text-white hover:bg-black rounded-md shadow-2xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Meeting Now</span>
            </button>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-4 py-1.5 text-xs font-medium bg-white border border-zinc-300 text-zinc-800 hover:bg-zinc-50 rounded-md shadow-2xs disabled:opacity-40"
              >
                Schedule for Later
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
