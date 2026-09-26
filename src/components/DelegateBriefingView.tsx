import React, { useState } from 'react';
import { DelegateSession } from '../types';
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Bot,
} from 'lucide-react';

interface DelegateBriefingViewProps {
  session: DelegateSession;
  onSelectMeeting?: (meetingId: string) => void;
}

export const DelegateBriefingView: React.FC<DelegateBriefingViewProps> = ({
  session,
  onSelectMeeting,
}) => {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [approvedItems, setApprovedItems] = useState<Record<string, boolean>>({});

  const b = session.briefing;

  const handleApprove = (id: string) => {
    setApprovedItems((prev) => ({ ...prev, [id]: true }));
  };

  const handleDeny = (id: string) => {
    setApprovedItems((prev) => ({ ...prev, [id]: false }));
  };

  return (
    <div className="bg-white rounded-lg p-6 sm:p-8 border border-zinc-200 relative animate-in fade-in duration-150 font-sans">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-100">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">
            WHILE YOU WERE AWAY
          </span>
          <h2 className="text-xl font-semibold text-zinc-900 mt-2">
            {b.meetingTitle}
          </h2>
          <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono mt-1">
            <span>{session.date}</span>
            <span>•</span>
            <span>{b.duration}</span>
            <span>•</span>
            <span>{session.participants.join(', ')}</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-50 border border-zinc-200 text-zinc-600 text-xs font-mono">
          <Bot className="w-3.5 h-3.5 text-zinc-500" />
          <span>Delegate Attended for Yaswanth</span>
        </div>
      </div>

      {/* Needs Your Attention (High Priority Card) */}
      {b.needsAttention && b.needsAttention.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-rose-50/70 border border-rose-200 text-zinc-900">
          <div className="flex items-center gap-1.5 text-rose-900 font-semibold text-xs uppercase tracking-wider mb-2 font-mono">
            <span>🔴 Needs Your Attention ({b.needsAttention.length})</span>
          </div>

          <div className="space-y-2.5">
            {b.needsAttention.map((na) => {
              const isResolved = approvedItems[na.id] !== undefined;
              const decisionState = approvedItems[na.id];

              return (
                <div
                  key={na.id}
                  className="p-3 rounded bg-white border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">{na.message}</p>
                    <p className="text-zinc-600 font-mono text-[11px] mt-0.5">{na.actionRequired}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isResolved ? (
                      <span
                        className={`font-mono text-xs font-bold px-2 py-1 rounded ${
                          decisionState
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {decisionState ? '✓ Approved' : '✗ Denied'}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(na.id)}
                          className="px-2.5 py-1 rounded bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeny(na.id)}
                          className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Important Points */}
      {b.important && b.important.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2">
            Important Discussion
          </h3>
          <ul className="space-y-1.5 text-xs text-zinc-800">
            {b.important.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-zinc-400">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decisions */}
      {b.decisions && b.decisions.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2">
            Decisions Recorded
          </h3>
          <ul className="space-y-1 text-xs text-zinc-800">
            {b.decisions.map((dec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{dec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Commitments */}
      {b.commitments && b.commitments.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2">
            Commitments
          </h3>
          <div className="space-y-1 font-mono text-xs">
            {b.commitments.map((com, i) => (
              <div key={i} className="flex items-center gap-2 text-zinc-800">
                <span className="font-semibold text-zinc-900">{com.owner}</span>
                <span className="text-zinc-400">→</span>
                <span>{com.task}</span>
                <span className="text-zinc-400">({com.deadline || 'Upcoming'})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Delegate Actions Summary Card */}
      <div className="mb-5 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-600 font-semibold mb-3 flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-zinc-500" />
          <span>AI Delegate Actions</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
          <div className="p-2 rounded bg-white border border-zinc-200">
            <div className="font-mono text-base font-bold text-zinc-900">
              {b.actionsTaken.answeredQuestions}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">Answered Qs</div>
          </div>
          <div className="p-2 rounded bg-white border border-zinc-200">
            <div className="font-mono text-base font-bold text-zinc-900">
              {b.actionsTaken.recordedDecisions}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">Decisions</div>
          </div>
          <div className="p-2 rounded bg-white border border-zinc-200">
            <div className="font-mono text-base font-bold text-zinc-900">
              {b.actionsTaken.createdTasks}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">Tasks Created</div>
          </div>
          <div className="p-2 rounded bg-white border border-zinc-200">
            <div className="font-mono text-base font-bold text-zinc-900">
              {b.actionsTaken.refusedActions}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">Refused / Guarded</div>
          </div>
        </div>

        {/* Detailed audit log */}
        <div className="space-y-1.5 border-t border-zinc-200 pt-2.5">
          {b.actionsTaken.details.map((detail, idx) => (
            <div key={idx} className="text-xs text-zinc-700 flex items-start gap-2">
              <span className="font-mono text-zinc-400 text-[10px]">{detail.timestamp}</span>
              <div>
                <span className="font-medium text-zinc-900">{detail.summary}</span>
                {detail.evidence && (
                  <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                    {detail.evidence}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible Transcript */}
      <div className="pt-3 border-t border-zinc-100">
        <button
          onClick={() => setShowFullTranscript(!showFullTranscript)}
          className="flex items-center justify-between w-full text-xs font-mono text-zinc-400 hover:text-zinc-700"
        >
          <span>Attended Transcript ({session.transcript.length} items)</span>
          {showFullTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showFullTranscript && (
          <div className="mt-2 p-3 rounded bg-zinc-50 border border-zinc-200 space-y-1.5 max-h-48 overflow-y-auto font-mono text-xs">
            {session.transcript.map((chunk) => (
              <div key={chunk.id} className="leading-relaxed">
                <span className="font-semibold text-zinc-900">{chunk.speaker}:</span>{' '}
                <span className="text-zinc-600">{chunk.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
