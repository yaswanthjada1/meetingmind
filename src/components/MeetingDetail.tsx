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
import { recordingService, RecordingState, RecordingSourceType } from '../services/recordingService';
import { processingQueue } from '../services/processingPipeline';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  Users,
  Link,
  Mic,
  MicOff,
  Upload,
  Play,
  Pause,
  Square,
  CheckCircle2,
  Circle,
  FileText,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Send,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Radio,
  ExternalLink,
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
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recDuration, setRecDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(meeting.meetingState === 'processing');
  const [processingStep, setProcessingStep] = useState(meeting.processingStep || 'Processing...');
  const [processingProgress, setProcessingProgress] = useState(meeting.processingProgress || 0);

  // Transcript state
  const [transcripts, setTranscripts] = useState<TranscriptChunk[]>([]);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  // Tasks local state for interactive toggling
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // In-Meeting Chat
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'user' | 'agent'; text: string; time: string }>
  >([]);
  const [isAnswering, setIsAnswering] = useState(false);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load meeting transcripts & tasks
  const loadMeetingData = async () => {
    const tr = await db.transcripts.where('meetingId').equals(meeting.id).toArray();
    setTranscripts(tr);

    const tks = await db.tasks.where('sourceMeetingId').equals(meeting.id).toArray();
    setTasks(tks);
  };

  useEffect(() => {
    loadMeetingData();

    // Subscribe to recording state
    const unsubRec = recordingService.subscribe((st, dur) => {
      setRecordingState(st);
      setRecDuration(dur);
    });

    // Subscribe to background processing queue
    const unsubProc = processingQueue.subscribe((jobs) => {
      const currentJob = jobs.find((j) => j.meetingId === meeting.id);
      if (currentJob) {
        setIsProcessing(true);
        setProcessingStep(currentJob.step);
        setProcessingProgress(currentJob.progress);
        if (currentJob.status === 'completed') {
          setIsProcessing(false);
          db.meetings.get(meeting.id).then((fresh) => {
            if (fresh) {
              onUpdate(fresh);
              loadMeetingData();
            }
          });
        }
      }
    });

    return () => {
      unsubRec();
      unsubProc();
    };
  }, [meeting.id]);

  // Start recording
  const handleStartRecording = async (sourceType: RecordingSourceType = 'microphone') => {
    const ok = await recordingService.start(sourceType);
    if (ok) {
      await db.meetings.update(meeting.id, {
        meetingState: 'recording',
      });
    }
  };

  // Pause / Resume
  const handlePauseResume = () => {
    if (recordingState === 'recording') {
      recordingService.pause();
    } else if (recordingState === 'paused') {
      recordingService.resume();
    }
  };

  // Stop recording & enqueue background processing
  const handleStopAndProcess = async () => {
    const audioBlob = await recordingService.stop();
    setIsProcessing(true);
    setProcessingStep('Recording stopped. Enqueueing background intelligence pipeline...');
    setProcessingProgress(15);

    await db.meetings.update(meeting.id, {
      meetingState: 'processing',
      processingStep: 'Processing meeting...',
      processingProgress: 15,
    });

    await processingQueue.enqueue(meeting.id, {
      audioBlob: audioBlob || undefined,
      userId: meeting.userId,
    });
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsProcessing(true);
    setProcessingStep(`Uploading ${file.name} and starting processing...`);
    setProcessingProgress(20);

    await db.meetings.update(meeting.id, {
      meetingState: 'processing',
      processingStep: 'Transcribing uploaded recording...',
      processingProgress: 20,
    });

    await processingQueue.enqueue(meeting.id, {
      uploadedFile: file,
      userId: meeting.userId,
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Toggle task completed state
  const handleToggleTask = async (task: TaskItem) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    task.status = nextStatus;
    await db.tasks.put(task);
    setTasks([...tasks]);
  };

  // Contextual Chat handler
  const handleSendChat = async (textToSend?: string) => {
    const q = (textToSend || chatQuery).trim();
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
      const response = await coordinator.process(`Regarding "${meeting.title}": ${q}`);
      const agentMsg = {
        sender: 'agent' as const,
        text: response.message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: 'Unable to reason over meeting context.', time: 'Now' },
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
        return <span className="text-xs text-black bg-white border border-zinc-300 px-2.5 py-0.5 rounded-md font-mono font-medium">In-person Meeting</span>;
      case 'discord':
        return <span className="text-xs text-black bg-white border border-zinc-300 px-2.5 py-0.5 rounded-md font-mono font-medium">Discord</span>;
      case 'phone':
        return <span className="text-xs text-black bg-white border border-zinc-300 px-2.5 py-0.5 rounded-md font-mono font-medium">Phone / Voice Call</span>;
      default:
        return <span className="text-xs text-black bg-white border border-zinc-300 px-2.5 py-0.5 rounded-md font-mono font-medium">External Meeting</span>;
    }
  };

  const isCompleted = meeting.meetingState === 'completed' || meeting.status === 'completed';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 font-sans animate-in fade-in duration-150">
      {/* Top Header & Back */}
      <div className="mb-6 pb-4 border-b border-zinc-200">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Schedule</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {platformBadge()}
              {meeting.meetingLink && (
                <a
                  href={meeting.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 underline font-mono"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Join Link</span>
                </a>
              )}
            </div>

            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
              {meeting.title}
            </h1>

            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-2 font-mono flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                {meeting.date}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                {meeting.startTime || '10:00'} – {meeting.endTime || '10:45'} ({meeting.durationMinutes}m)
              </span>
              {meeting.participants.length > 0 && (
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

      {/* Recording & Processing Control Panel */}
      <div className="mb-8 bg-zinc-50/70 border border-zinc-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 uppercase font-mono tracking-wider">
              Meeting Session Capture
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Record microphone, capture browser tab audio, or upload meeting recording (.mp3, .wav, .m4a, .mp4, .webm).
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".mp3,.wav,.m4a,.mp4,.webm,.txt,.md"
            className="hidden"
          />

          {/* If currently recording */}
          {recordingState === 'recording' || recordingState === 'paused' ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-md">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-mono font-semibold text-white">
                  {formatTimer(recDuration)}
                </span>
              </div>

              <button
                onClick={handlePauseResume}
                className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-100 border border-zinc-300 rounded-md text-zinc-800 transition-colors"
              >
                {recordingState === 'paused' ? 'Resume' : 'Pause'}
              </button>

              <button
                onClick={handleStopAndProcess}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop & Process</span>
              </button>
            </div>
          ) : isProcessing ? (
            <div className="flex items-center gap-2 text-xs font-mono text-black bg-zinc-100 border border-black px-3 py-1.5 rounded-md">
              <span className="w-2 h-2 rounded-full bg-black animate-spin" />
              <span>{processingStep} ({processingProgress}%)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStartRecording('microphone')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record Session</span>
              </button>

              <button
                onClick={() => handleStartRecording('screen')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 rounded-md transition-colors"
                title="Capture Google Meet / Zoom tab audio"
              >
                <Video className="w-3.5 h-3.5 text-zinc-600" />
                <span>Capture Tab Audio</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 rounded-md transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-600" />
                <span>Upload Recording</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Intelligence Body */}
      {isCompleted ? (
        <div className="space-y-8">
          {/* Summary Section */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
            <h2 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-2">
              Executive Summary
            </h2>
            <p className="text-sm text-zinc-800 leading-relaxed font-sans">
              {meeting.summary || 'Summary generated from meeting discussion.'}
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

            {/* Decisions */}
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

          {/* Commitments & Tasks */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
            <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-4">
              Commitments & Action Items
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
                        <button
                          type="button"
                          className="text-zinc-400 hover:text-zinc-900"
                        >
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
                            Assigned to: <span className="font-semibold text-zinc-600">{task.assignee}</span>
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

            {/* Referenced Resources */}
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
                <p className="text-xs text-zinc-400 italic">No specific external documents matched.</p>
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
                  Full Meeting Transcript
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {transcripts.length > 0 ? `${transcripts.length} segmented chunks` : 'Raw text notes available'}
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
                  <p className="text-zinc-400 text-xs italic">No transcript available.</p>
                )}
              </div>
            )}
          </section>

          {/* Ask MeetingMind Contextual Chat */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
            <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
              Ask MeetingMind About This Meeting
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Query decisions, commitments, or specific speaker points from this meeting.
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
        /* Not yet recorded / upcoming state */
        <div className="border border-dashed border-zinc-300 rounded-xl p-16 text-center bg-white">
          <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-800 mb-1">
            Meeting hasn't happened yet
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto mb-6">
            When this meeting begins on {meeting.platform || 'your external platform'}, click <strong>Record Session</strong> or upload the audio recording afterward to generate meeting intelligence.
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => handleStartRecording('microphone')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record Session Now</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 rounded-md transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-500" />
              <span>Upload Recording</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
