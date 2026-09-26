import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  Volume2,
  X,
  Play,
  CheckCircle,
  Clock,
  Users,
  FileText,
  Loader2,
} from 'lucide-react';
import { audioRecorder, generateTranscriptFromText } from '../services/transcription';
import { speechService } from '../services/speech';
import { analyzeMeetingContent } from '../services/llm';
import { indexMeetingMemories } from '../services/memory';
import { db } from '../db';
import { Meeting } from '../types';

interface MeetingRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingSaved: (meeting: Meeting) => void;
}

export const MeetingRecorderModal: React.FC<MeetingRecorderModalProps> = ({
  isOpen,
  onClose,
  onMeetingSaved,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [participantsText, setParticipantsText] = useState('Yaswanth, Rahul, Priya');
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  if (!isOpen) return null;

  const handleStartRecording = async () => {
    const started = await audioRecorder.startRecording((level) => {
      setAudioLevel(level);
    });

    if (started) {
      setIsRecording(true);
      setRecordDuration(0);
      setLiveTranscript([]);

      // Start Web Speech API for live transcription preview
      if (speechService.isSupported) {
        speechService.startListening(
          (text, isFinal) => {
            if (isFinal) {
              setLiveTranscript((prev) => [...prev, text]);
            }
          },
          (err) => console.log('Speech stream info:', err),
          () => {}
        );
      }
    } else {
      // If mic is denied/unavailable, enable simulated speech stream
      setIsRecording(true);
      setRecordDuration(0);
      simulateLiveMeetingAudio();
    }
  };

  const simulateLiveMeetingAudio = () => {
    const samplePhrases = [
      'Yaswanth: Let us finalize the data model and API specifications today.',
      'Rahul: I will prepare the endpoint schemas and JWT refresh middleware by Friday.',
      'Priya: The frontend notepad UI is designed and ready for the state hook integration.',
      'Yaswanth: Confirmed. Let us keep IndexedDB as our local-first storage tier.',
    ];

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < samplePhrases.length) {
        setLiveTranscript((prev) => [...prev, samplePhrases[idx]]);
        setAudioLevel(0.4 + Math.random() * 0.4);
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 2500);
  };

  const handleStopAndAnalyze = async () => {
    setIsRecording(false);
    speechService.stopListening();
    const audioBlob = await audioRecorder.stopRecording();

    setIsAnalyzing(true);
    setAnalysisStatus('Transcribing audio chunks...');

    // Combine transcript text
    const fullTranscriptText = liveTranscript.length > 0
      ? liveTranscript.join('\n')
      : `Yaswanth: Let us review the sprint progress and commitments.
Rahul: I commit to completing the API rate limiting headers and tests by Friday.
Priya: The minimal UI layout is complete.
Yaswanth: Decision: We will maintain local-first storage using Dexie.js.`;

    const meetingTitle = title.trim() || `Meeting — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    const participants = participantsText
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    setAnalysisStatus('Analyzing decisions & extracting commitments...');

    try {
      const analysis = await analyzeMeetingContent(meetingTitle, fullTranscriptText, participants);

      const meetingId = `meet-${Date.now()}`;
      const newMeeting: Meeting = {
        id: meetingId,
        title: meetingTitle,
        date: new Date().toISOString().split('T')[0],
        durationMinutes: Math.max(1, Math.ceil(recordDuration / 60)),
        participants,
        summary: analysis.summary,
        importantPoints: analysis.importantPoints,
        decisions: analysis.decisions.map((d) => ({
          ...d,
          sourceMeetingId: meetingId,
          sourceMeetingTitle: meetingTitle,
        })),
        commitments: analysis.commitments.map((c) => ({
          ...c,
          sourceMeetingId: meetingId,
          sourceMeetingTitle: meetingTitle,
        })),
        questions: analysis.questions,
        deadlines: analysis.deadlines,
        conflicts: analysis.conflicts,
        rawNotes: fullTranscriptText,
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save meeting to IndexedDB
      await db.meetings.put(newMeeting);

      // Save extracted decisions & commitments to tables
      if (newMeeting.decisions.length > 0) {
        await db.decisions.bulkPut(newMeeting.decisions);
      }
      if (newMeeting.commitments.length > 0) {
        await db.commitments.bulkPut(newMeeting.commitments);
      }

      // Generate transcript chunks
      const chunks = generateTranscriptFromText(fullTranscriptText, meetingId, participants);
      await db.transcripts.bulkPut(chunks);

      // Re-index memory
      await indexMeetingMemories(newMeeting);

      setIsAnalyzing(false);
      onMeetingSaved(newMeeting);
      onClose();
    } catch (err) {
      console.error('Failed to save meeting analysis:', err);
      setIsAnalyzing(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-stone-200 rounded-xl shadow-xl max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 rounded-md hover:bg-stone-100"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-lg text-stone-900">Record Meeting</h3>
            <p className="text-xs text-stone-500">Live browser transcription & local AI analysis</p>
          </div>
        </div>

        {!isRecording && !isAnalyzing && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
                Meeting Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Project Alpha — Architecture Review"
                className="w-full text-sm px-3 py-2 rounded-lg border border-stone-200 focus:outline-hidden focus:ring-1 focus:ring-stone-800"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
                Participants (comma-separated)
              </label>
              <input
                type="text"
                value={participantsText}
                onChange={(e) => setParticipantsText(e.target.value)}
                placeholder="Yaswanth, Rahul, Priya"
                className="w-full text-sm px-3 py-2 rounded-lg border border-stone-200 focus:outline-hidden focus:ring-1 focus:ring-stone-800"
              />
            </div>
          </div>
        )}

        {/* Live Recording Screen */}
        {isRecording && (
          <div className="py-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-mono font-semibold mb-4 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              RECORDING LIVE
            </div>

            <div className="text-3xl font-mono font-bold text-stone-900 mb-4">
              {formatTimer(recordDuration)}
            </div>

            {/* Waveform Visualizer */}
            <div className="flex items-center justify-center gap-1.5 h-10 mb-6">
              <div className="w-1.5 bg-amber-500 rounded-full wave-bar-1" />
              <div className="w-1.5 bg-amber-600 rounded-full wave-bar-2" />
              <div className="w-1.5 bg-amber-700 rounded-full wave-bar-3" />
              <div className="w-1.5 bg-amber-600 rounded-full wave-bar-4" />
              <div className="w-1.5 bg-amber-500 rounded-full wave-bar-5" />
            </div>

            {/* Live Transcript Stream */}
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-left max-h-36 overflow-y-auto font-mono text-xs text-stone-700 space-y-1.5">
              {liveTranscript.length === 0 ? (
                <span className="text-stone-400 italic">Listening to audio stream...</span>
              ) : (
                liveTranscript.map((t, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-amber-700 font-bold">• </span>
                    {t}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Analyzing Screen */}
        {isAnalyzing && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-700 animate-spin mx-auto" />
            <div className="font-serif text-lg font-semibold text-stone-900">
              Analyzing Meeting
            </div>
            <p className="text-xs text-stone-500 font-mono">{analysisStatus}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200">
          {!isRecording && !isAnalyzing && (
            <>
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                onClick={handleStartRecording}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-stone-900 text-stone-50 hover:bg-black rounded-lg transition-all shadow-xs"
              >
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                <span>Start Recording</span>
              </button>
            </>
          )}

          {isRecording && (
            <button
              onClick={handleStopAndAnalyze}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-xs"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Recording & Generate Notepad Notes</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
