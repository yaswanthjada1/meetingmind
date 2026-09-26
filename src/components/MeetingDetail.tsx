import React, { useState, useEffect, useRef } from 'react';
import {
  Meeting,
  MeetingPlatform,
  TranscriptChunk,
  Decision,
  Commitment,
  TaskItem,
  ReferencedResource,
} from '../types';
import { db } from '../db';
import { coordinator } from '../agent/coordinator';
import { recordingManager, RecordingServiceSnapshot, CaptureMode } from '../services/recordingService';
import { processingQueue, ProcessingJob, PipelineStageStatus } from '../services/processingPipeline';
import { formatDisplayDate } from '../utils/dateUtils';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  Users,
  ExternalLink,
  Mic,
  Upload,
  Square,
  Pause,
  Play,
  CheckCircle2,
  Circle,
  FileText,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Send,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdate: (updated: Meeting) => void;
}

export const MeetingDetail: React.FC<MeetingDetailProps> = ({
  meeting,
  onBack,
  onUpdate,
}) => {
  // Global Recording Manager state
  const [recSnapshot, setRecSnapshot] = useState<RecordingServiceSnapshot>(recordingManager.getSnapshot());
  const isThisMeetingRecording = recSnapshot.activeMeetingId === meeting.id && (recSnapshot.state === 'recording' || recSnapshot.state === 'paused');

  // Background Processing state
  const [processingJob, setProcessingJob] = useState<ProcessingJob | undefined>(processingQueue.getJob(meeting.id));

  // Transcript state
  const [transcripts, setTranscripts] = useState<TranscriptChunk[]>([]);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  // Tasks local state
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // In-Meeting Chat state
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'user' | 'agent'; text: string; time: string; sources?: string[] }>
  >([]);
  const [isAnswering, setIsAnswering] = useState(false);

  // File upload ref for notes / audio
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load meeting transcripts & tasks from IndexedDB
  const loadMeetingData = async () => {
    const tr = await db.transcripts.where('meetingId').equals(meeting.id).toArray();
    setTranscripts(tr);

    const tks = await db.tasks.where('sourceMeetingId').equals(meeting.id).toArray();
    setTasks(tks);
  };

  useEffect(() => {
    loadMeetingData();

    // Subscribe to global recording manager
    const unsubRec = recordingManager.subscribe((snap) => {
      setRecSnapshot(snap);
    });

    // Subscribe to background processing queue
    const unsubProc = processingQueue.subscribe((jobs) => {
      const currentJob = jobs.find((j) => j.meetingId === meeting.id);
      setProcessingJob(currentJob);

      if (currentJob?.status === 'completed' || currentJob?.status === 'transcription_unavailable') {
        db.meetings.get(meeting.id).then((fresh) => {
          if (fresh) {
            onUpdate(fresh);
            loadMeetingData();
          }
        });
      }
    });

    return () => {
      unsubRec();
      unsubProc();
    };
  }, [meeting.id]);

  // Direct user-initiated capture: Tab Audio (getDisplayMedia)
  const handleEnableTabAudioCapture = async () => {
    await recordingManager.startTabAudioCapture(meeting.id, meeting.userId || 'default_user');
  };

  // Direct user-initiated capture: Microphone (getUserMedia)
  const handleStartMicrophoneCapture = async () => {
    await recordingManager.startMicrophoneCapture(meeting.id, meeting.userId || 'default_user');
  };

  // Stop recording & enqueue background processing
  const handleStopRecording = async () => {
    const record = await recordingManager.stopRecording();
    const liveChunks = recordingManager.getLiveTranscriptChunks();

    await processingQueue.enqueue(meeting.id, {
      audioBlob: record?.blob,
      liveTranscriptChunks: liveChunks,
      userId: meeting.userId,
    });
  };

  // Upload meeting recording or transcript notes
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isText = file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.csv');

    if (isText) {
      const notesText = await file.text();
      await processingQueue.enqueue(meeting.id, {
        uploadedNotes: notesText,
        userId: meeting.userId,
      });
    } else {
      await processingQueue.enqueue(meeting.id, {
        audioBlob: file,
        userId: meeting.userId,
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Open external meeting link safely in new tab
  const handleOpenMeetingLink = () => {
    const url = meeting.meetingUrl || meeting.meetingLink;
    if (!url) return;
    try {
      const valid = new URL(url);
      window.open(valid.href, '_blank', 'noopener,noreferrer');
    } catch (e) {
      alert('Invalid meeting URL.');
    }
  };

  // Toggle task status
  const handleToggleTask = async (task: TaskItem) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    task.status = nextStatus;
    await db.tasks.put(task);
    setTasks([...tasks]);
  };

  // In-Meeting Grounded Chat
  const handleSendChat = async () => {
    const q = chatQuery.trim();
    if (!q) return;

    const userMsg = {
      sender: 'user' as const,
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatQuery('');
    setIsAnswering(true);

    try {
      const response = await coordinator.process(
        `Regarding meeting "${meeting.title}" on ${meeting.date}: ${q}`,
        meeting.userId
      );
      const agentMsg = {
        sender: 'agent' as const,
        text: response.message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: response.evidence?.retrievedSources.map((s) => s.title),
      };
      setChatMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: 'I couldn\'t find enough information in your MeetingMind data to answer this.',
          time: 'Now',
        },
      ]);
    } finally {
      setIsAnswering(false);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const platformBadge = () => {
    switch (meeting.platform) {
      case 'google_meet':
        return <span className="text-xs text-black bg-white border border-zinc-300 px-2.5 py-0.5 rounded-md font-mono font-medium">Google Meet</span>;
      case 'zoom':
        return <span className="text-xs text-black bg-white border border-zinc-300 px-2.5 py-0.5 rounded-md font-mono font-medium">Zoom</span>;
      case 'teams':
        return <span className="text-xs text-black bg-white border border-zinc-300 px-2.5 py-0.5 rounded-md font-mono font-medium">Microsoft Teams</span>;
      case 'in_person':
        return <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md font-medium">In-person</span>;
      case 'discord':
        return <span className="text-xs text-black bg-white border border-zinc-300 px-2.5 py-0.5 rounded-md font-mono font-medium">Discord</span>;
      case 'phone':
        return <span className="text-xs text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md font-medium">Phone</span>;
      default:
        return <span className="text-xs text-zinc-700 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-md font-medium">External</span>;
    }
  };

  const isCompleted = meeting.meetingState === 'completed' || meeting.status === 'completed';
  const meetingUrl = meeting.meetingUrl || meeting.meetingLink;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 font-sans animate-in fade-in duration-150">
      {/* Top Header & Navigation */}
      <div className="mb-6 pb-4 border-b border-zinc-200">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Calendar</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {platformBadge()}
              {meetingUrl && (
                <button
                  onClick={handleOpenMeetingLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-md transition-colors"
                >
                  <ExternalLink className="w-3 h-3 text-zinc-600" />
                  <span>Open Meeting</span>
                </button>
              )}
            </div>

            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
              {meeting.title}
            </h1>

            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-2 font-mono flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                {formatDisplayDate(meeting.date)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                {meeting.startTime || '10:00'} ({meeting.durationMinutes} min)
              </span>
              {meeting.participants && meeting.participants.length > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-sans">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    {meeting.participants.join(', ')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input for recording / transcript notes upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".mp3,.wav,.m4a,.mp4,.webm,.txt,.md,.csv"
        className="hidden"
      />

      {/* Capture Alert Error Banner (e.g. Tab Audio Not Checked) */}
      {recSnapshot.errorMessage && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-1 duration-150">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{recSnapshot.errorMessage}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              To record audio from Google Meet, Zoom, or Teams in Chrome, choose the tab from the list and ensure the <strong>"Share tab audio"</strong> toggle is enabled.
            </div>
          </div>
        </div>
      )}

      {/* Recording & Capture Control Panel */}
      <div className="mb-8 bg-zinc-50/70 border border-zinc-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 uppercase font-mono tracking-wider">
              Meeting Audio Capture
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Capture meeting tab audio with explicit permission, use microphone for in-person, or upload notes.
            </p>
          </div>

          {/* ACTIVE RECORDING STATE */}
          {isThisMeetingRecording ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                <span className="text-xs font-mono font-semibold text-red-700">
                  Recording {formatTimer(recSnapshot.durationSeconds)}
                </span>
              </div>

              <button
                onClick={() =>
                  recSnapshot.state === 'recording'
                    ? recordingManager.pauseRecording()
                    : recordingManager.resumeRecording()
                }
                className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-100 border border-zinc-300 rounded-md text-zinc-800 transition-colors"
              >
                {recSnapshot.state === 'paused' ? 'Resume' : 'Pause'}
              </button>

              <button
                onClick={handleStopRecording}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Recording</span>
              </button>
            </div>
          ) : processingJob && processingJob.status !== 'completed' ? (
            /* PROCESSING STATE WITH AUTHENTIC PROGRESS */
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-700 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-md">
              <Loader2 className="w-3.5 h-3.5 text-zinc-900 animate-spin" />
              <span>{processingJob.step}</span>
            </div>
          ) : (
            /* READY / CAPTURE INITIATION */
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleEnableTabAudioCapture}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
                title="Capture audio from Google Meet or Zoom tab"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Enable Meeting Capture</span>
              </button>

              <button
                onClick={handleStartMicrophoneCapture}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 rounded-md transition-colors"
                title="Record with microphone for in-person sessions"
              >
                <Mic className="w-3.5 h-3.5 text-zinc-600" />
                <span>Microphone</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 rounded-md transition-colors"
                title="Upload audio recording or transcript notes"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-600" />
                <span>Upload Audio / Notes</span>
              </button>
            </div>
          )}
        </div>

        {/* PROCESSING STAGES CHECKLIST (DISPLAYED DURING/AFTER PROCESSING) */}
        {processingJob && (
          <div className="mt-4 pt-4 border-t border-zinc-200/80 space-y-2 font-mono text-xs">
            <div className="font-semibold text-zinc-800 text-[11px] mb-2 uppercase tracking-wider">
              Processing Pipeline
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {processingJob.stages.map((stage) => (
                <div
                  key={stage.id}
                  className={`flex items-center justify-between p-2 rounded border ${
                    stage.status === 'completed'
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                      : stage.status === 'active'
                      ? 'bg-zinc-100 border-zinc-300 text-zinc-900 font-semibold'
                      : stage.status === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : stage.status === 'skipped'
                      ? 'bg-zinc-50/40 border-zinc-200 text-zinc-400'
                      : stage.status === 'failed'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-zinc-50/30 border-zinc-100 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {stage.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : stage.status === 'active' ? (
                      <Loader2 className="w-3.5 h-3.5 text-zinc-800 animate-spin shrink-0" />
                    ) : stage.status === 'warning' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                    )}
                    <span className="truncate">{stage.label}</span>
                  </div>
                  {stage.detail && (
                    <span className="text-[10px] text-zinc-500 font-normal ml-2 truncate">
                      {stage.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Intelligence Body */}
      {isCompleted ? (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Executive Summary */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
            <h2 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-2">
              Executive Summary
            </h2>
            <p className="text-sm text-zinc-800 leading-relaxed font-sans">
              {meeting.summary || 'Summary unavailable.'}
            </p>
          </section>

          {/* Important Points & Decisions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Important Points */}
            <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
              <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-3">
                Important Points
              </h3>
              {meeting.importantPoints && meeting.importantPoints.length > 0 ? (
                <ul className="space-y-2.5">
                  {meeting.importantPoints.map((ip, idx) => (
                    <li key={idx} className="text-xs text-zinc-700 flex items-start gap-2">
                      <span className="text-zinc-400 mt-0.5">•</span>
                      <span>{ip.point}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400 italic">No key points extracted.</p>
              )}
            </section>

            {/* Decisions Agreed */}
            <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
              <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-3">
                Decisions Agreed
              </h3>
              {meeting.decisions && meeting.decisions.length > 0 ? (
                <div className="space-y-3">
                  {meeting.decisions.map((dec, idx) => (
                    <div key={idx} className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-3">
                      <div className="text-xs font-semibold text-zinc-900 mb-1">
                        {dec.decision}
                      </div>
                      {dec.reason && (
                        <div className="text-[11px] text-zinc-500 leading-snug">
                          {dec.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">No formal decisions recorded.</p>
              )}
            </section>
          </div>

          {/* Commitments & Action Items */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
            <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-4">
              Commitments & Tasks
            </h3>
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const isDone = task.status === 'done';
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(task)}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                        isDone
                          ? 'bg-zinc-50/50 border-zinc-200 opacity-60'
                          : 'bg-white border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button type="button" className="text-zinc-400 hover:text-zinc-900">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-black" />
                          ) : (
                            <Circle className="w-4 h-4 text-zinc-300" />
                          )}
                        </button>
                        <div>
                          <div
                            className={`text-xs font-medium ${
                              isDone ? 'line-through text-zinc-400' : 'text-zinc-800'
                            }`}
                          >
                            {task.title}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                            Assigned: <span className="font-semibold text-zinc-600">{task.assignee}</span>
                            {task.deadline && ` • Due: ${task.deadline}`}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">
                        {task.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : meeting.commitments && meeting.commitments.length > 0 ? (
              <div className="space-y-2">
                {meeting.commitments.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-800">{c.owner}</span>
                      <span className="text-zinc-400 mx-1.5">→</span>
                      <span className="text-zinc-700">{c.task}</span>
                    </div>
                    {c.deadline && (
                      <span className="text-[11px] font-mono text-zinc-500">
                        {c.deadline}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">No commitments recorded.</p>
            )}
          </section>

          {/* Unresolved Questions & Referenced Resources */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Unresolved Questions */}
            <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
              <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-3">
                Unresolved Questions
              </h3>
              {meeting.unresolvedQuestions && meeting.unresolvedQuestions.length > 0 ? (
                <ul className="space-y-2">
                  {meeting.unresolvedQuestions.map((q, idx) => (
                    <li key={idx} className="text-xs text-zinc-700 flex items-start gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-black shrink-0 mt-0.5" />
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400 italic">All items resolved.</p>
              )}
            </section>

            {/* Referenced RAG Resources */}
            <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
              <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-3">
                Referenced RAG Resources
              </h3>
              {meeting.resourcesReferenced && meeting.resourcesReferenced.length > 0 ? (
                <div className="space-y-2">
                  {meeting.resourcesReferenced.map((res, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded bg-zinc-50 border border-zinc-200 text-xs">
                      <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-zinc-800">{res.title}</span>
                        <span className="text-[10px] text-zinc-400 ml-1">({res.filename})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">No external documents matched.</p>
              )}
            </section>
          </div>

          {/* Transcript Accordion */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
            <button
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider">
                  Meeting Transcript
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {transcripts.length > 0 ? `${transcripts.length} transcript chunks` : 'Transcript stream'}
                </p>
              </div>

              {showFullTranscript ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {showFullTranscript && (
              <div className="mt-4 pt-4 border-t border-zinc-100 max-h-80 overflow-y-auto space-y-3 font-mono text-xs">
                {transcripts.length > 0 ? (
                  transcripts.map((t) => (
                    <div key={t.id} className="text-zinc-700">
                      <span className="text-zinc-400 font-semibold">{t.speaker}</span>
                      <span className="text-zinc-300 mx-1.5">({t.timestamp})</span>
                      <span>: {t.text}</span>
                    </div>
                  ))
                ) : meeting.rawNotes ? (
                  <pre className="whitespace-pre-wrap font-sans text-xs text-zinc-700">
                    {meeting.rawNotes}
                  </pre>
                ) : (
                  <p className="text-zinc-400 text-xs italic">No transcript recorded.</p>
                )}
              </div>
            )}
          </section>

          {/* Grounded In-Meeting Chat */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
            <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
              Ask About This Meeting
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Answers are grounded strictly in this meeting's transcript, decisions, and matched resources using qwen3:8b.
            </p>

            {chatMessages.length > 0 && (
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto p-3 bg-zinc-50 rounded-lg border border-zinc-200/80">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`text-xs p-3 rounded-lg max-w-[85%] ${
                        msg.sender === 'user'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white border border-zinc-200 text-zinc-800'
                      }`}
                    >
                      {msg.text}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-1.5 pt-1 border-t border-zinc-100 text-[10px] font-mono text-zinc-400">
                          Source: {msg.sources.join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 mt-0.5">{msg.time}</span>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder={`Ask anything about "${meeting.title}"...`}
                className="flex-1 text-xs px-3.5 py-2 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-500 bg-white"
              />
              <button
                type="submit"
                disabled={isAnswering || !chatQuery.trim()}
                className="px-3.5 py-2 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-colors shadow-2xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </section>
        </div>
      ) : (
        /* Upcoming / Unrecorded State */
        <div className="border border-dashed border-zinc-300 rounded-xl p-16 text-center bg-white">
          <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-800 mb-1">
            Meeting hasn't started
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto mb-6">
            When this meeting begins on {meeting.platform || 'your meeting platform'}, click <strong>Enable Meeting Capture</strong> to share the meeting tab audio, or use the microphone for in-person discussion.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {meetingUrl && (
              <button
                onClick={handleOpenMeetingLink}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 rounded-md transition-all shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Meeting</span>
              </button>
            )}

            <button
              onClick={handleEnableTabAudioCapture}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Enable Meeting Capture</span>
            </button>

            <button
              onClick={handleStartMicrophoneCapture}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 rounded-md transition-colors"
            >
              <Mic className="w-3.5 h-3.5 text-zinc-500" />
              <span>Microphone</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
