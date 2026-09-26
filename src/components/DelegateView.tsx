import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { DelegateSession, DelegatePermissions, AppSettings } from '../types';
import { DelegateBriefingView } from './DelegateBriefingView';
import { SimulatedMeetingModal } from './SimulatedMeetingModal';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Bot,
  Play,
  CheckCircle2,
  AlertTriangle,
  History,
  Lock,
  Sparkles,
  UserCheck,
  Calendar,
} from 'lucide-react';

interface DelegateViewProps {
  userId?: string;
  onSelectMeeting?: (meetingId: string) => void;
  onRequestSimulatedMeeting?: () => void;
}

export const DelegateView: React.FC<DelegateViewProps> = ({ userId = '', onSelectMeeting }) => {
  const [sessions, setSessions] = useState<DelegateSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [permissions, setPermissions] = useState<DelegatePermissions>({
    canAnswerQuestions: true,
    canRetrieveHistory: true,
    canTakeNotes: true,
    canCreateTasks: true,
    canAcceptTasks: false,
    canChangeDeadlines: false,
    canMakeTechnicalDecisions: false,
    canScheduleMeetings: false,
  });
  const [showConflictBanner, setShowConflictBanner] = useState(false);

  const loadData = async () => {
    if (!userId) {
      setSessions([]);
      return;
    }
    const list = await db.delegateSessions.where('userId').equals(userId).reverse().sortBy('createdAt');
    setSessions(list);
    if (list.length > 0 && !selectedSessionId) {
      setSelectedSessionId(list[0].id);
    }
    const settings = await db.settings.get(`settings_${userId}`) || await db.settings.get('current_settings');
    if (settings?.permissions) {
      setPermissions(settings.permissions);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handlePermissionToggle = async (key: keyof DelegatePermissions) => {
    const updated = { ...permissions, [key]: !permissions[key] };
    setPermissions(updated);
    const settingsKey = userId ? `settings_${userId}` : 'current_settings';
    const settings = await db.settings.get(settingsKey);
    if (settings) {
      settings.permissions = updated;
      await db.settings.put(settings);
    }
  };

  const handleSessionComplete = (newSession: DelegateSession) => {
    setSessions((prev) => [newSession, ...prev]);
    setSelectedSessionId(newSession.id);
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 animate-in fade-in duration-150 font-sans">
      {/* Top Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            AI Delegate
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Deterministic permission boundaries • Attends meetings and produces post-meeting briefings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConflictBanner(true)}
            className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-md transition-all shadow-2xs"
            title="Simulate scheduling conflict and prompt delegate attendance"
          >
            Simulate Conflict
          </button>

          <button
            onClick={() => setIsSimModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Launch Simulated Meeting</span>
          </button>
        </div>
      </div>

      {/* Conflict Prompt Banner */}
      {showConflictBanner && (
        <div className="mb-6 p-4 rounded-lg bg-zinc-50 border border-zinc-300 text-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-zinc-200 text-zinc-800">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-900 uppercase tracking-wider">
                Simulated Calendar Conflict
              </div>
              <p className="text-xs text-zinc-700 mt-0.5">
                A scheduling conflict has been detected during an upcoming meeting.
              </p>
              <p className="text-xs font-medium text-zinc-900 mt-1">
                You're unavailable. Would you like MeetingMind to attend as your AI Delegate?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={() => {
                setShowConflictBanner(false);
                setIsSimModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all"
            >
              Enable AI Delegate & Attend
            </button>
            <button
              onClick={() => setShowConflictBanner(false)}
              className="px-2.5 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Deterministic Permission Matrix (Section 13) */}
      <div className="bg-white rounded-lg p-5 mb-8 border border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-700" />
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              Deterministic Permission Matrix
            </h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Enforced before LLM generation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* 1. Answer Questions */}
          <div
            onClick={() => handlePermissionToggle('canAnswerQuestions')}
            className="p-3 rounded-md border border-zinc-200 bg-zinc-50/50 hover:bg-white cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-zinc-900">Answer Questions</span>
              <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                {permissions.canAnswerQuestions ? 'ALLOW' : 'DENY'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">Provide facts from meeting memory.</p>
          </div>

          {/* 2. Retrieve History */}
          <div
            onClick={() => handlePermissionToggle('canRetrieveHistory')}
            className="p-3 rounded-md border border-zinc-200 bg-zinc-50/50 hover:bg-white cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-zinc-900">Retrieve History</span>
              <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                {permissions.canRetrieveHistory ? 'ALLOW' : 'DENY'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">Search indexed past discussions.</p>
          </div>

          {/* 3. Change Deadlines (ASK/REFUSE) */}
          <div
            onClick={() => handlePermissionToggle('canChangeDeadlines')}
            className="p-3 rounded-md border border-zinc-200 bg-zinc-50/50 hover:bg-white cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-zinc-900">Change Deadlines</span>
              <span
                className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                  permissions.canChangeDeadlines
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-zinc-200 text-zinc-800'
                }`}
              >
                {permissions.canChangeDeadlines ? 'ALLOW' : 'ASK / REFUSE'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">Refuses changes and records for approval.</p>
          </div>

          {/* 4. Technical Decisions (DENY) */}
          <div
            onClick={() => handlePermissionToggle('canMakeTechnicalDecisions')}
            className="p-3 rounded-md border border-zinc-200 bg-zinc-50/50 hover:bg-white cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-zinc-900">Technical Decisions</span>
              <span
                className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                  permissions.canMakeTechnicalDecisions
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {permissions.canMakeTechnicalDecisions ? 'ALLOW' : 'DENY'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">Reserved exclusively for engineering lead.</p>
          </div>
        </div>
      </div>

      {/* Attended Sessions Selector & Briefing View */}
      {sessions.length > 0 ? (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
            <span className="text-xs font-mono text-zinc-400 whitespace-nowrap">
              Briefings:
            </span>
            {sessions.map((sess) => (
              <button
                key={sess.id}
                onClick={() => setSelectedSessionId(sess.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                  selectedSessionId === sess.id
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {sess.meetingTitle} ({sess.date})
              </button>
            ))}
          </div>

          {selectedSession && (
            <DelegateBriefingView
              session={selectedSession}
              onSelectMeeting={onSelectMeeting}
            />
          )}
        </div>
      ) : (
        <div className="border border-dashed border-zinc-200 rounded-lg p-10 text-center bg-white">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-medium text-zinc-800 mb-1">No AI Delegate Briefings Yet</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto mb-4">
            When you're unavailable for a meeting, your AI Delegate can attend on your behalf according to your deterministic permission boundaries and generate a post-meeting briefing.
          </p>
          <button
            onClick={() => setIsSimModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Launch Simulated Meeting</span>
          </button>
        </div>
      )}

      {/* Simulated Meeting Modal */}
      <SimulatedMeetingModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        onSessionComplete={handleSessionComplete}
        permissions={permissions}
        userId={userId}
      />
    </div>
  );
};
