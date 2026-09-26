import React, { useState, useEffect, useRef } from 'react';
import { Meeting, MeetingLifecycleState, TranscriptChunk, Decision, Commitment, ImportantPoint, RecordingState } from '../types';
import { recordingManager } from '../services/recordingService';
import { speechService } from '../services/speech';
import { analyzeMeetingContent } from '../services/llm';
import { indexMeetingMemories } from '../services/memory';
import { db } from '../db';
import {
  Mic,
  Square,
  Pause,
  Play,
  CheckCircle2,
  AlertTriangle,
  Users,
  Clock,
  ArrowLeft,
  Sparkles,
  Save,
  Check,
  RotateCcw,
  MicOff,
} from 'lucide-react';

interface LiveMeetingWorkspaceProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdate: (updated: Meeting) => void;
  onEndMeetingSession?: () => void;
}

export const LiveMeetingWorkspace: React.FC<LiveMeetingWorkspaceProps> = ({
  meeting,
  onBack,
  onUpdate,
}) => {
  const [meetingState, setMeetingState] = useState<MeetingLifecycleState>(
    meeting.meetingState || 'scheduled'
  );
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<RecordingState>('ready');

  // Real transcripts — starts EMPTY
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([]);

  // Real live AI insights — starts EMPTY
  const [liveImportant, setLiveImportant] = useState<string[]>([]);
  const [liveDecisions, setLiveDecisions] = useState<string[]>([]);
  const [liveCommitments, setLiveCommitments] = useState<Array<{ owner: string; task: string; deadline: string; confirmed: boolean }>>([]);

  // Alert banner for newly detected item
  const [pendingCommitmentAlert, setPendingCommitmentAlert] = useState<{
    owner: string;
    task: string;
    deadline: string;
  } | null>(null);

  // Mic permission and speech recognition status
  const [micAvailable, setMicAvailable] = useState<boolean | null>(null);
  const [speechAvailable, setSpeechAvailable] = useState(speechService.isSupported);
  const [transcriptionNotice, setTranscriptionNotice] = useState('');

  // Post-Meeting Final Summary
  const [isFinalizing, setIsFinalizing] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to recording service
  useEffect(() => {
    const unsub = recordingManager.subscribe((snap) => {
      setRecordingStatus(snap.state);
      setRecordSeconds(snap.durationSeconds);
    });
    return () => unsub();
  }, []);

  // Auto-start live recording on mount if meeting state is live/starting
  useEffect(() => {
    if (meetingState === 'starting' || meetingState === 'live') {
      startLiveMeeting();
    }
  }, []);

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const startLiveMeeting = async () => {
    setMeetingState('starting');

    // Request microphone & start recording
    const started = await recordingManager.startMicrophoneCapture(meeting.id, meeting.userId || 'default_user');
    if (started) {
      setMicAvailable(true);
    } else {
      setMicAvailable(false);
    }

    setMeetingState('live');

    // Update meeting state in DB
    await db.meetings.update(meeting.id, {
      meetingState: 'live',
      status: 'in-progress',
      updatedAt: Date.now(),
    });

    // Start Web Speech API recognition (real transcription from mic)
    if (speechService.isSupported) {
      setSpeechAvailable(true);
      speechService.startListening(
        (text, isFinal) => {
          if (isFinal && text.trim().length > 0) {
            const chunk: TranscriptChunk = {
              id: `tc-${Date.now()}`,
              userId: meeting.userId,
              meetingId: meeting.id,
              timestamp: formatTimer(recordingManager.getSnapshot().durationSeconds),
              speaker: 'Speaker',
              text: text.trim(),
              createdAt: Date.now(),
            };
            setTranscript((prev) => [...prev, chunk]);
            detectLiveAiPatterns(text, 'Speaker');
          }
        },
        () => {
          // On end — Web Speech API sometimes auto-stops; restart if still live
          if (recordingManager.getSnapshot().state === 'recording') {
            setTimeout(() => {
              if (recordingManager.getSnapshot().state === 'recording' && speechService.isSupported) {
                speechService.startListening(
                  (text, isFinal) => {
                    if (isFinal && text.trim().length > 0) {
                      const chunk: TranscriptChunk = {
                        id: `tc-${Date.now()}`,
                        userId: meeting.userId,
                        meetingId: meeting.id,
                        timestamp: formatTimer(recordingManager.getSnapshot().durationSeconds),
                        speaker: 'Speaker',
                        text: text.trim(),
                        createdAt: Date.now(),
                      };
                      setTranscript((prev) => [...prev, chunk]);
                      detectLiveAiPatterns(text, 'Speaker');
                    }
                  },
                  () => {},
                  () => {}
                );
              }
            }, 500);
          }
        },
        () => {
          setTranscriptionNotice('Speech recognition encountered an error. Transcription may be unavailable.');
        }
      );
    } else {
      setSpeechAvailable(false);
      setTranscriptionNotice('Web Speech API not supported in this browser. Recording audio only — no live transcription.');
    }
  };

  const detectLiveAiPatterns = (text: string, speaker: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('will do') || lower.includes('commit') || lower.includes('by friday') || lower.includes('by wednesday') || lower.includes('i will') || lower.includes('let me')) {
      setPendingCommitmentAlert({
        owner: speaker,
        task: text,
        deadline: lower.includes('friday') ? 'Friday' : lower.includes('wednesday') ? 'Wednesday' : 'Upcoming',
      });
    }

    if (lower.includes('decided') || lower.includes('let\'s go with') || lower.includes('we should use')) {
      setLiveDecisions((prev) => [...prev, text]);
    }

    if (lower.includes('important') || lower.includes('key point') || lower.includes('note that')) {
      setLiveImportant((prev) => [...prev, text]);
    }
  };

  const handleConfirmCommitment = (com: { owner: string; task: string; deadline: string }) => {
    setLiveCommitments((prev) => [...prev, { ...com, confirmed: true }]);
    setPendingCommitmentAlert(null);
  };

  const handlePauseResume = () => {
    if (meetingState === 'live') {
      recordingManager.pauseRecording();
      speechService.stopListening();
      setMeetingState('paused');
    } else if (meetingState === 'paused') {
      recordingManager.resumeRecording();
      setMeetingState('live');
    }
  };

  const handleEndMeeting = async () => {
    setMeetingState('ending');
    speechService.stopListening();
    const recording = await recordingManager.stopRecording();
    const audioBlob = recording?.blob;
    setMeetingState('processing');
    setIsFinalizing(true);

    // Finalize meeting analysis
    const fullTranscriptText = transcript.map((t) => `${t.speaker}: ${t.text}`).join('\n');
    const audioBlobUrl = audioBlob ? URL.createObjectURL(audioBlob) : undefined;

    try {
      let analysis;
      if (fullTranscriptText.trim().length > 10) {
        analysis = await analyzeMeetingContent(meeting.title, fullTranscriptText, meeting.participants);
      } else {
        analysis = {
          summary: `Meeting "${meeting.title}" completed. No transcript content was captured.`,
          importantPoints: [],
          decisions: [],
          commitments: [],
          questions: [],
          deadlines: [],
          conflicts: [],
        };
      }

      const updated: Meeting = {
        ...meeting,
        summary: analysis.summary,
        importantPoints: analysis.importantPoints,
        decisions: analysis.decisions.map((d) => ({
          ...d,
          userId: meeting.userId,
          sourceMeetingId: meeting.id,
          sourceMeetingTitle: meeting.title,
          date: meeting.date,
        })),
        commitments: analysis.commitments.map((c) => ({
          ...c,
          userId: meeting.userId,
          sourceMeetingId: meeting.id,
          sourceMeetingTitle: meeting.title,
        })),
        questions: analysis.questions,
        deadlines: analysis.deadlines,
        conflicts: analysis.conflicts,
        rawNotes: fullTranscriptText || meeting.rawNotes || '',
        audioBlobUrl,
        status: 'completed',
        meetingState: 'completed',
        updatedAt: Date.now(),
      };

      await db.meetings.put(updated);

      // Save transcript chunks to DB
      if (transcript.length > 0) {
        await db.transcripts.bulkPut(transcript);
      }

      // Save decisions and commitments
      if (updated.decisions.length > 0) await db.decisions.bulkPut(updated.decisions);
      if (updated.commitments.length > 0) await db.commitments.bulkPut(updated.commitments);

      // Index into memory for future retrieval
      await indexMeetingMemories(updated);

      // Create tasks from commitments
      for (const c of updated.commitments) {
        await db.tasks.put({
          id: `task-${c.id}`,
          userId: meeting.userId,
          title: c.task,
          assignee: c.owner,
          deadline: c.deadline,
          status: 'todo',
          priority: c.priority || 'medium',
          sourceMeetingId: meeting.id,
          sourceMeetingTitle: meeting.title,
          createdAt: Date.now(),
        });
      }

      onUpdate(updated);
      setMeetingState('completed');
    } catch (e) {
      console.error('Finalization error:', e);
      // Still mark as completed even if analysis fails
      await db.meetings.update(meeting.id, {
        status: 'completed',
        meetingState: 'completed',
        rawNotes: fullTranscriptText,
        audioBlobUrl,
        updatedAt: Date.now(),
      });
      setMeetingState('completed');
    } finally {
      setIsFinalizing(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 animate-in fade-in duration-150 font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-200">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Calendar</span>
        </button>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          {meetingState === 'live' && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black text-white text-xs font-mono font-medium">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ● LIVE · Recording {formatTimer(recordSeconds)}
              </span>

              <button
                onClick={handlePauseResume}
                className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md transition-colors text-xs flex items-center gap-1"
                title="Pause recording"
              >
                <Pause className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pause</span>
              </button>

              <button
                onClick={handleEndMeeting}
                className="px-3 py-1 bg-zinc-900 hover:bg-black text-white rounded-md text-xs font-medium transition-colors shadow-2xs"
              >
                End Meeting
              </button>
            </div>
          )}

          {meetingState === 'paused' && (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-600 text-xs font-mono">
                ❚❚ PAUSED ({formatTimer(recordSeconds)})
              </span>
              <button
                onClick={handlePauseResume}
                className="px-3 py-1 bg-zinc-900 hover:bg-black text-white rounded-md text-xs font-medium"
              >
                Resume
              </button>
              <button
                onClick={handleEndMeeting}
                className="px-3 py-1 bg-black hover:bg-zinc-800 text-white rounded-md text-xs font-medium"
              >
                End Meeting
              </button>
            </div>
          )}

          {meetingState === 'scheduled' && (
            <button
              onClick={startLiveMeeting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-black rounded-md shadow-2xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Meeting & Auto-Record</span>
            </button>
          )}

          {meetingState === 'starting' && (
            <span className="px-3 py-1 text-xs text-zinc-500 font-mono">Starting...</span>
          )}
        </div>
      </div>

      {/* Meeting Title & Participants */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
          {meeting.title}
        </h1>
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mt-1">
          <span>{meeting.date}</span>
          <span>•</span>
          <span>{meeting.durationMinutes} min</span>
          {meeting.participants.length > 0 && (
            <>
              <span>•</span>
              <span className="text-zinc-700">{meeting.participants.join(' · ')}</span>
            </>
          )}
        </div>
      </div>

      {/* Transcription Notice */}
      {transcriptionNotice && (meetingState === 'live' || meetingState === 'paused') && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-100 border border-black text-xs text-black flex items-start gap-2">
          <MicOff className="w-4 h-4 text-black shrink-0 mt-0.5" />
          <span>{transcriptionNotice}</span>
        </div>
      )}

      {/* Mic permission status */}
      {micAvailable === false && (meetingState === 'live' || meetingState === 'paused') && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-100 border border-black text-xs text-black flex items-start gap-2">
          <MicOff className="w-4 h-4 text-black shrink-0 mt-0.5" />
          <span>Microphone access was denied. Recording is running in simulated mode. Grant microphone permission and restart the meeting for real recording.</span>
        </div>
      )}

      {/* Live Alert for Newly Detected Commitment */}
      {pendingCommitmentAlert && (
        <div className="mb-6 p-3.5 rounded-lg bg-zinc-50 border border-zinc-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-start gap-2.5">
            <span className="text-sm">⚠</span>
            <div>
              <span className="font-semibold text-zinc-900">New commitment detected:</span>
              <p className="text-zinc-700 mt-0.5">
                <strong>{pendingCommitmentAlert.owner}</strong> → {pendingCommitmentAlert.task} (Target: {pendingCommitmentAlert.deadline})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => handleConfirmCommitment(pendingCommitmentAlert)}
              className="px-3 py-1 text-xs font-medium bg-zinc-900 text-white hover:bg-black rounded-md"
            >
              Confirm
            </button>
            <button
              onClick={() => setPendingCommitmentAlert(null)}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {meetingState === 'processing' && (
        <div className="p-12 text-center border border-dashed border-zinc-200 rounded-lg space-y-3 my-8">
          <div className="w-6 h-6 rounded-full border-2 border-zinc-800 border-t-transparent animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-900">Finalizing Meeting Intelligence</h3>
          <p className="text-xs text-zinc-500 font-mono">
            Analyzing transcript, extracting decisions & commitments, saving to local memory...
          </p>
        </div>
      )}

      {/* Completed State — Show Meeting Summary */}
      {meetingState === 'completed' && (
        <div className="space-y-6 my-4">
          <div className="p-4 bg-zinc-100 border border-black rounded-lg text-center">
            <CheckCircle2 className="w-6 h-6 text-black mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-black">Meeting Completed</h3>
            <p className="text-xs text-black mt-1">
              All data has been saved to local memory and is now searchable.
            </p>
          </div>

          <button
            onClick={onBack}
            className="w-full py-2 text-xs font-medium bg-zinc-900 text-white hover:bg-black rounded-md"
          >
            Back to Calendar
          </button>
        </div>
      )}

      {/* Live Workspace Grid: Transcript Stream (Left) + Live AI Notes (Right) */}
      {meetingState !== 'processing' && meetingState !== 'completed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Live Transcript */}
          <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col h-[460px]">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-100">
              <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                TRANSCRIPT
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {transcript.length} entries
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 font-sans text-xs pr-1">
              {transcript.length === 0 && (meetingState === 'live' || meetingState === 'paused') && (
                <div className="flex items-center justify-center h-full text-zinc-400 text-xs font-mono text-center px-4">
                  {speechAvailable
                    ? 'Listening... Speak into your microphone and transcription will appear here.'
                    : 'Speech recognition unavailable. Audio is being recorded.'}
                </div>
              )}

              {transcript.length === 0 && meetingState === 'scheduled' && (
                <div className="flex items-center justify-center h-full text-zinc-400 text-xs font-mono text-center">
                  Start the meeting to begin transcription.
                </div>
              )}

              {transcript.map((chunk) => (
                <div key={chunk.id} className="space-y-0.5">
                  <div className="text-[10px] font-mono text-zinc-400">
                    <span className="font-semibold text-zinc-800">{chunk.speaker}</span> · {chunk.timestamp}
                  </div>
                  <p className="text-zinc-700 leading-relaxed bg-zinc-50/60 p-2.5 rounded border border-zinc-100">
                    {chunk.text}
                  </p>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Right Column: Live AI Notes */}
          <div className="bg-zinc-50/70 border border-zinc-200 rounded-lg p-4 flex flex-col h-[460px] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
              <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                LIVE AI NOTES
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">Auto-extracting</span>
            </div>

            {liveImportant.length === 0 && liveDecisions.length === 0 && liveCommitments.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs font-mono text-center px-4">
                AI insights will appear here as the meeting progresses and patterns are detected in the conversation.
              </div>
            )}

            {/* Important */}
            {liveImportant.length > 0 && (
              <div>
                <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5 font-semibold">
                  Important
                </h4>
                <ul className="space-y-1 text-xs text-zinc-800">
                  {liveImportant.map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-zinc-400">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Decisions */}
            {liveDecisions.length > 0 && (
              <div>
                <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5 font-semibold">
                  Decisions
                </h4>
                <div className="space-y-1.5">
                  {liveDecisions.map((dec, i) => (
                    <div key={i} className="p-2 rounded bg-white border border-zinc-200 text-xs text-zinc-900">
                      <strong>Decision:</strong> {dec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commitments */}
            {liveCommitments.length > 0 && (
              <div>
                <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5 font-semibold">
                  Commitments
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  {liveCommitments.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 p-2 bg-white rounded border border-zinc-200 text-zinc-800">
                      <span className="font-semibold">{c.owner}</span>
                      <span className="text-zinc-400">→</span>
                      <span className="truncate flex-1">{c.task}</span>
                      <span className="text-zinc-400 text-[10px]">({c.deadline})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
