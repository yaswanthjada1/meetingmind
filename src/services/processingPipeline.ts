import { db } from '../db';
import {
  Meeting,
  TranscriptChunk,
  Decision,
  Commitment,
  TaskItem,
  ReferencedResource,
  MeetingAnalysis,
} from '../types';
import { audioProcessingService, CleanedAudioResult } from './audioProcessing';
import { defaultTranscriptionProvider, TranscriptionResult } from './transcriptionProvider';
import { resourceIngestion } from './resourceIngestion';
import { analyzeMeetingContent } from './llm';
import { indexMeetingMemories } from './memory';

export type ProcessingPipelineStage =
  | 'queued'
  | 'saving_recording'
  | 'cleaning_audio'
  | 'transcribing'
  | 'searching_resources'
  | 'reasoning'
  | 'completed'
  | 'transcription_unavailable'
  | 'error';

export interface PipelineStageStatus {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'warning' | 'skipped' | 'failed';
  detail?: string;
}

export interface ProcessingJob {
  meetingId: string;
  meetingTitle: string;
  progress: number; // 0 to 100
  step: string;
  status: ProcessingPipelineStage;
  stages: PipelineStageStatus[];
  error?: string;
}

class ProcessingQueueManager {
  private jobs: Map<string, ProcessingJob> = new Map();
  private listeners: Array<(jobs: ProcessingJob[]) => void> = [];

  subscribe(callback: (jobs: ProcessingJob[]) => void) {
    this.listeners.push(callback);
    callback(Array.from(this.jobs.values()));
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    const list = Array.from(this.jobs.values());
    this.listeners.forEach((cb) => cb(list));
  }

  getActiveJobs(): ProcessingJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.status !== 'completed' && j.status !== 'error' && j.status !== 'transcription_unavailable');
  }

  getAllJobs(): ProcessingJob[] {
    return Array.from(this.jobs.values());
  }

  getJob(meetingId: string): ProcessingJob | undefined {
    return this.jobs.get(meetingId);
  }

  private updateJob(meetingId: string, updates: Partial<ProcessingJob>) {
    const current = this.jobs.get(meetingId);
    if (current) {
      const updated = { ...current, ...updates };
      this.jobs.set(meetingId, updated);
      this.notify();
    }
  }

  /**
   * Enqueues a meeting for background processing.
   * Runs asynchronously without blocking the user interface.
   */
  async enqueue(
    meetingId: string,
    options: {
      audioBlob?: Blob;
      uploadedNotes?: string;
      liveTranscriptChunks?: TranscriptChunk[];
      userId?: string;
    } = {}
  ): Promise<void> {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting) return;

    const initialStages: PipelineStageStatus[] = [
      { id: 'recording', label: 'Recording saved', status: 'pending' },
      { id: 'cleaning', label: 'Audio cleaning', status: 'pending' },
      { id: 'transcription', label: 'Transcribing conversation', status: 'pending' },
      { id: 'rag', label: 'Searching relevant resources', status: 'pending' },
      { id: 'reasoning', label: 'Extracting decisions & commitments', status: 'pending' },
      { id: 'summary', label: 'Generating meeting summary', status: 'pending' },
    ];

    const job: ProcessingJob = {
      meetingId,
      meetingTitle: meeting.title,
      progress: 5,
      step: 'Processing meeting...',
      status: 'queued',
      stages: initialStages,
    };

    this.jobs.set(meetingId, job);
    this.notify();

    // Fire processing in background
    this.processJob(meetingId, options).catch((err) => {
      console.error('Processing failed for meeting:', meetingId, err);
      this.updateJob(meetingId, {
        status: 'error',
        step: 'Processing failed',
        error: err?.message || 'Processing failed',
      });
      db.meetings.update(meetingId, {
        meetingState: 'failed',
        processingStep: `Failed: ${err?.message || 'Error'}`,
      }).catch(() => {});
    });
  }

  private async processJob(
    meetingId: string,
    options: {
      audioBlob?: Blob;
      uploadedNotes?: string;
      liveTranscriptChunks?: TranscriptChunk[];
      userId?: string;
    }
  ) {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting) return;

    const userId = options.userId || meeting.userId || 'default_user';
    const stages: PipelineStageStatus[] = [
      { id: 'recording', label: 'Recording saved', status: 'completed' },
      { id: 'cleaning', label: 'Audio cleaning', status: 'active' },
      { id: 'transcription', label: 'Transcribing conversation', status: 'pending' },
      { id: 'rag', label: 'Searching relevant resources', status: 'pending' },
      { id: 'reasoning', label: 'Extracting decisions & commitments', status: 'pending' },
      { id: 'summary', label: 'Generating meeting summary', status: 'pending' },
    ];

    await db.meetings.update(meetingId, {
      meetingState: 'processing',
      processingStep: 'Cleaning audio...',
      processingProgress: 15,
    });

    this.updateJob(meetingId, {
      status: 'cleaning_audio',
      progress: 15,
      step: 'Cleaning audio...',
      stages,
    });

    // 1. REAL AUDIO CLEANING (Web Audio API)
    let cleanedAudio: CleanedAudioResult | null = null;
    let cleaningErrorMsg: string | undefined = undefined;

    if (options.audioBlob && options.audioBlob.size > 0) {
      try {
        cleanedAudio = await audioProcessingService.cleanAudio(options.audioBlob);
      } catch (err: any) {
        console.warn('Audio cleaning non-fatal error:', err);
        cleaningErrorMsg = err?.message || 'Audio decoding unavailable';
      }
    }

    if (cleanedAudio) {
      stages[1].status = 'completed';
      stages[1].detail = `Trimmed ${cleanedAudio.silenceTrimmedSec.toFixed(1)}s silence`;
    } else if (cleaningErrorMsg) {
      stages[1].status = 'warning';
      stages[1].label = 'Audio cleaning unavailable';
      stages[1].detail = 'Original audio preserved';
    } else {
      stages[1].status = 'completed';
      stages[1].detail = 'Cleaned';
    }
    stages[2].status = 'active';

    this.updateJob(meetingId, {
      status: 'transcribing',
      progress: 35,
      step: 'Transcribing conversation...',
      stages: [...stages],
    });

    await db.meetings.update(meetingId, {
      processingStep: 'Transcribing conversation...',
      processingProgress: 35,
    });

    // 2. DEPENDENCY-AWARE TRANSCRIPTION (DO NOT GUESS)
    const transcriptResult: TranscriptionResult = await defaultTranscriptionProvider.transcribe({
      audioBlob: cleanedAudio?.cleanedBlob || options.audioBlob,
      liveTranscriptChunks: options.liveTranscriptChunks,
      uploadedNotes: options.uploadedNotes,
      meetingId,
      userId,
      participants: meeting.participants,
    });

    // 3. CHECK TRANSCRIPTION AVAILABILITY
    if (!transcriptResult.available || !transcriptResult.text.trim()) {
      // RULE: Do not run reasoning if transcription failed.
      // Accurate status:
      // ✓ Recording saved
      // ✓ Audio cleaned
      // ⚠ Transcription unavailable
      // ○ RAG analysis skipped
      // ○ Decisions unavailable
      // ○ Summary unavailable
      stages[2].status = 'warning';
      stages[2].detail = transcriptResult.reason || 'Transcription is not configured.';
      stages[3].status = 'skipped';
      stages[4].status = 'skipped';
      stages[5].status = 'skipped';

      const reasonMsg = transcriptResult.reason || 'Audio captured successfully, but transcription is not configured.';
      const fallbackSummary = cleaningErrorMsg
        ? 'Audio was captured successfully. Audio cleaning was unavailable, so the original recording was preserved. Transcription is unavailable because no STT provider is configured.'
        : 'Audio was captured and cleaned. Transcription is unavailable because no STT provider is configured.';

      this.updateJob(meetingId, {
        status: 'transcription_unavailable',
        progress: 100,
        step: reasonMsg,
        stages: [...stages],
      });

      await db.meetings.update(meetingId, {
        meetingState: 'completed',
        status: 'completed',
        processingStep: reasonMsg,
        processingProgress: 100,
        summary: fallbackSummary,
        updatedAt: Date.now(),
      });

      return;
    }

    // Transcription is genuine & available
    stages[2].status = 'completed';
    stages[2].detail = `${transcriptResult.chunks.length} chunks transcribed`;
    stages[3].status = 'active';

    this.updateJob(meetingId, {
      status: 'searching_resources',
      progress: 60,
      step: 'Searching relevant resources via RAG...',
      stages: [...stages],
    });

    // Save actual transcript chunks in DB
    if (transcriptResult.chunks.length > 0) {
      await db.transcripts.bulkPut(transcriptResult.chunks);
    }

    // 4. REAL RAG RETRIEVAL (using qwen3-embedding:0.6b)
    const referencedResources: ReferencedResource[] = [];
    let resourceContext = '';

    try {
      const matchedChunks = await resourceIngestion.searchResources(
        transcriptResult.text.substring(0, 500),
        3,
        userId
      );

      for (const m of matchedChunks) {
        referencedResources.push({
          id: m.chunk.resourceId,
          title: m.resourceTitle,
          filename: m.filename,
          snippet: m.snippet,
        });
        resourceContext += `[Source: ${m.filename} - ${m.heading || 'Section'}]\n${m.chunk.text}\n\n`;
      }
    } catch (ragErr) {
      console.warn('RAG search warning:', ragErr);
    }

    stages[3].status = 'completed';
    stages[3].detail = `${referencedResources.length} relevant documents matched`;
    stages[4].status = 'active';

    this.updateJob(meetingId, {
      status: 'reasoning',
      progress: 75,
      step: 'Extracting decisions & commitments with qwen3:8b...',
      stages: [...stages],
    });

    await db.meetings.update(meetingId, {
      processingStep: 'Reasoning over meeting content with qwen3:8b...',
      processingProgress: 75,
    });

    // 5. REASONING WITH qwen3:8b
    let analysis: MeetingAnalysis;
    try {
      analysis = await analyzeMeetingContent(
        meeting.title,
        transcriptResult.text,
        meeting.participants,
        resourceContext
      );
    } catch (llmErr: any) {
      stages[4].status = 'failed';
      stages[4].detail = 'Reasoning failed';
      stages[5].status = 'skipped';

      this.updateJob(meetingId, {
        status: 'error',
        progress: 100,
        step: `Analysis failed: ${llmErr?.message || 'Invalid structured output'}`,
        stages: [...stages],
        error: llmErr?.message,
      });

      await db.meetings.update(meetingId, {
        meetingState: 'failed',
        processingStep: 'Meeting analysis failed — model returned invalid structured output.',
        rawNotes: transcriptResult.text,
      });
      return;
    }

    stages[4].status = 'completed';
    stages[4].detail = `${analysis.decisions.length} decisions, ${analysis.commitments.length} commitments`;
    stages[5].status = 'active';

    this.updateJob(meetingId, {
      status: 'reasoning',
      progress: 90,
      step: 'Saving structured meeting intelligence...',
      stages: [...stages],
    });

    // 6. SAVE STRUCTURED DECISIONS, COMMITMENTS & TASKS
    const decisions: Decision[] = (analysis.decisions || []).map((d, idx) => ({
      id: `dec-${meetingId}-${idx}-${Date.now()}`,
      userId,
      decision: d.decision,
      reason: d.reason || `Agreed during ${meeting.title}`,
      alternatives: d.alternatives || [],
      participants: d.participants?.length ? d.participants : meeting.participants,
      sourceMeetingId: meetingId,
      sourceMeetingTitle: meeting.title,
      date: meeting.date,
      status: 'active',
    }));

    const commitments: Commitment[] = (analysis.commitments || []).map((c, idx) => ({
      id: `com-${meetingId}-${idx}-${Date.now()}`,
      userId,
      owner: c.owner || meeting.participants[0] || 'Team',
      task: c.task,
      deadline: c.deadline || 'Upcoming',
      sourceMeetingId: meetingId,
      sourceMeetingTitle: meeting.title,
      status: 'pending',
      confidence: c.confidence || 0.95,
      priority: 'high',
    }));

    const tasks: TaskItem[] = commitments.map((c, idx) => ({
      id: `task-${meetingId}-${idx}-${Date.now()}`,
      userId,
      title: c.task,
      assignee: c.owner,
      deadline: c.deadline,
      status: 'todo',
      priority: 'high',
      sourceMeetingId: meetingId,
      sourceMeetingTitle: meeting.title,
      createdAt: Date.now() + idx,
    }));

    if (decisions.length > 0) await db.decisions.bulkPut(decisions);
    if (commitments.length > 0) await db.commitments.bulkPut(commitments);
    if (tasks.length > 0) await db.tasks.bulkPut(tasks);

    // Save final meeting record
    const updatedMeeting: Meeting = {
      ...meeting,
      summary: analysis.summary,
      importantPoints: analysis.importantPoints || [],
      decisions,
      commitments,
      questions: analysis.questions || [],
      deadlines: analysis.deadlines || [],
      conflicts: analysis.conflicts || [],
      unresolvedQuestions: (analysis.questions || []).filter((q) => !q.answered).map((q) => q.question),
      resourcesReferenced: referencedResources,
      rawNotes: transcriptResult.text,
      status: 'completed',
      meetingState: 'completed',
      processingStep: 'Processed',
      processingProgress: 100,
      updatedAt: Date.now(),
    };

    await db.meetings.put(updatedMeeting);

    // Index memories for chatbot & future cross-meeting queries
    try {
      await indexMeetingMemories(updatedMeeting);
    } catch (e) {
      console.warn('Memory indexing error:', e);
    }

    stages[5].status = 'completed';
    stages[5].detail = 'Executive summary ready';

    this.updateJob(meetingId, {
      status: 'completed',
      progress: 100,
      step: '✓ Meeting intelligence ready',
      stages: [...stages],
    });
  }
}

export const processingQueue = new ProcessingQueueManager();
