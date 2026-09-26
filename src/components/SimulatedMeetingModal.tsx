import React, { useState } from 'react';
import {
  Shield,
  Bot,
  User,
  Send,
  X,
  Play,
  ArrowRight,
} from 'lucide-react';
import { handleDelegateMeetingTurn, finalizeDelegateSession } from '../services/delegate';
import { DelegatePermissions, TranscriptChunk, DelegateSession } from '../types';

interface SimulatedMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionComplete: (session: DelegateSession) => void;
  permissions: DelegatePermissions;
  userId?: string;
}

export const SimulatedMeetingModal: React.FC<SimulatedMeetingModalProps> = ({
  isOpen,
  onClose,
  onSessionComplete,
  permissions,
  userId = '',
}) => {
  const [meetingTitle, setMeetingTitle] = useState('Sync & Architecture Discussion');
  const [activeSpeaker, setActiveSpeaker] = useState('Team Member');
  const [inputMessage, setInputMessage] = useState('');
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([
    {
      id: 'st-1',
      meetingId: 'sim-current',
      timestamp: '00:02',
      speaker: 'System',
      text: 'Meeting started. MeetingMind AI Delegate is attending on your behalf with active permission boundaries.',
      createdAt: 1,
    },
  ]);
  const [actionsLog, setActionsLog] = useState<
    Array<{ type: any; summary: string; timestamp: string; evidence?: string }>
  >([]);
  const [needsAttentionList, setNeedsAttentionList] = useState<
    Array<{ message: string; actionRequired: string }>
  >([]);

  if (!isOpen) return null;

  const handleSendTurn = async (textToSend?: string, speakerOverride?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    const speaker = speakerOverride || activeSpeaker;
    const nowTimestamp = `${String(Math.floor(transcript.length * 1.5)).padStart(2, '0')}:15`;

    const userChunk: TranscriptChunk = {
      id: `st-${Date.now()}-u`,
      meetingId: 'sim-current',
      timestamp: nowTimestamp,
      speaker,
      text,
      createdAt: Date.now(),
    };

    const newTranscript = [...transcript, userChunk];
    setTranscript(newTranscript);
    setInputMessage('');

    // Execute Delegate response with deterministic permission check
    const turnResult = await handleDelegateMeetingTurn(
      speaker,
      text,
      newTranscript,
      permissions,
      userId
    );

    const delegateChunk: TranscriptChunk = {
      id: `st-${Date.now()}-d`,
      meetingId: 'sim-current',
      timestamp: `${String(Math.floor((transcript.length + 1) * 1.5)).padStart(2, '0')}:20`,
      speaker: 'MeetingMind (Delegate)',
      text: turnResult.response,
      createdAt: Date.now() + 100,
    };

    setTranscript((prev) => [...prev, delegateChunk]);

    const actionItem = {
      type: turnResult.actionTaken,
      summary: `${turnResult.actionTaken.toUpperCase()}: ${turnResult.response}`,
      timestamp: nowTimestamp,
      evidence: turnResult.evidenceSnippet,
    };
    setActionsLog((prev) => [...prev, actionItem]);

    if (turnResult.needsAttentionItem) {
      setNeedsAttentionList((prev) => [...prev, turnResult.needsAttentionItem!]);
    }
  };

  const handleEndMeeting = async () => {
    const participants = Array.from(
      new Set(
        transcript
          .map((t) => t.speaker)
          .filter((s) => s && !s.includes('Delegate') && s !== 'System')
      )
    );
    if (participants.length === 0) participants.push(activeSpeaker || 'Team');

    const session = await finalizeDelegateSession(
      meetingTitle,
      Math.max(5, Math.round(transcript.length * 3.5)),
      participants,
      transcript,
      actionsLog,
      needsAttentionList,
      permissions,
      userId
    );
    onSessionComplete(session);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-2xl w-full flex flex-col h-[600px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                Simulated Meeting Room
              </h3>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-200 px-1.5 py-0.2 rounded">
                Attending on your behalf
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{meetingTitle}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Test Scenarios Bar */}
        <div className="px-4 py-2 bg-zinc-100/70 border-b border-zinc-200 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-mono text-zinc-500 font-semibold mr-1">Test Scenarios:</span>
          <button
            onClick={() =>
              handleSendTurn('What was decided regarding the system architecture in our previous discussion?', activeSpeaker)
            }
            className="px-2 py-1 rounded bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-[11px]"
          >
            1. Query Decisions (ALLOW)
          </button>
          <button
            onClick={() =>
              handleSendTurn('Can we move the project milestone deadline from Friday to next week?', activeSpeaker)
            }
            className="px-2 py-1 rounded bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-[11px]"
          >
            2. Request Deadline Extension (ASK/REFUSE)
          </button>
          <button
            onClick={() =>
              handleSendTurn('Can we switch the database to a completely different stack?', activeSpeaker)
            }
            className="px-2 py-1 rounded bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-[11px]"
          >
            3. Propose Tech Change (DENY)
          </button>
        </div>

        {/* Live Meeting Transcript Chat stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans bg-white">
          {transcript.map((chunk) => {
            const isDelegate = chunk.speaker.includes('Delegate');

            return (
              <div
                key={chunk.id}
                className={`flex flex-col ${isDelegate ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-zinc-400">
                  <span className="font-semibold text-zinc-700">{chunk.speaker}</span>
                  <span>• {chunk.timestamp}</span>
                </div>

                <div
                  className={`p-3 rounded-lg max-w-[85%] text-xs leading-relaxed ${
                    isDelegate
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-800 border border-zinc-200/60'
                  }`}
                >
                  {chunk.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Input & Meeting Control */}
        <div className="p-3 bg-zinc-50 border-t border-zinc-200 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={activeSpeaker}
              onChange={(e) => setActiveSpeaker(e.target.value)}
              placeholder="Speaker name"
              className="text-xs px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white font-mono text-zinc-700 w-32"
            />

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendTurn()}
              placeholder={`Type a question or proposal as ${activeSpeaker}...`}
              className="flex-1 text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white focus:outline-hidden focus:border-zinc-400"
            />

            <button
              onClick={() => handleSendTurn()}
              className="p-1.5 bg-zinc-900 hover:bg-black text-white rounded-md"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-mono text-zinc-400">
              Deterministic Boundary: canChangeDeadlines = REFUSE
            </span>
            <button
              onClick={handleEndMeeting}
              className="px-3 py-1 text-xs font-medium bg-zinc-900 hover:bg-black text-white rounded-md transition-colors shadow-2xs"
            >
              End Meeting & Generate Briefing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
