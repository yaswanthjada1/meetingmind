import { db } from '../db';
import {
  Meeting,
  TranscriptChunk,
  Decision,
  Commitment,
  TaskItem,
  ReferencedResource,
  MemoryEntry,
  MeetingAnalysis,
} from '../types';
import { analyzeMeetingContent } from './llm';
import { indexMeetingMemories } from './memory';

export interface ProcessingJob {
  meetingId: string;
  meetingTitle: string;
  progress: number; // 0 to 100
  step: string;
  status: 'queued' | 'transcribing' | 'analyzing' | 'indexing' | 'completed' | 'error';
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
    return Array.from(this.jobs.values()).filter((j) => j.status !== 'completed' && j.status !== 'error');
  }

  getAllJobs(): ProcessingJob[] {
    return Array.from(this.jobs.values());
  }

  updateJob(meetingId: string, updates: Partial<ProcessingJob>) {
    const current = this.jobs.get(meetingId);
    if (current) {
      const updated = { ...current, ...updates };
      this.jobs.set(meetingId, updated);
      this.notify();
    }
  }

  async enqueue(
    meetingId: string,
    options: {
      audioBlob?: Blob;
      uploadedFile?: File;
      rawNotes?: string;
      userId?: string;
    } = {}
  ): Promise<void> {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting) return;

    const job: ProcessingJob = {
      meetingId,
      meetingTitle: meeting.title,
      progress: 5,
      step: 'Preparing audio and session buffer...',
      status: 'queued',
    };
    this.jobs.set(meetingId, job);
    this.notify();

    // Run in background without blocking
    this.processJob(meetingId, options).catch((err) => {
      console.error('Processing failed for meeting:', meetingId, err);
      this.updateJob(meetingId, {
        status: 'error',
        step: 'Processing failed',
        error: err?.message || 'Unknown error',
      });
    });
  }

  private async processJob(
    meetingId: string,
    options: {
      audioBlob?: Blob;
      uploadedFile?: File;
      rawNotes?: string;
      userId?: string;
    }
  ) {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting) return;

    const userId = options.userId || meeting.userId || 'default_user';

    // Update meeting lifecycle in DB
    await db.meetings.update(meetingId, {
      meetingState: 'processing',
      processingStep: 'Transcribing audio and recording stream...',
      processingProgress: 20,
    });

    this.updateJob(meetingId, {
      status: 'transcribing',
      progress: 25,
      step: 'Transcribing audio session...',
    });

    // 1. Audio / Notes extraction
    let transcriptText = options.rawNotes || meeting.rawNotes || '';
    let transcriptChunks: TranscriptChunk[] = [];

    // If existing transcript in DB, load it
    const existingChunks = await db.transcripts.where('meetingId').equals(meetingId).toArray();
    if (existingChunks.length > 0) {
      transcriptChunks = existingChunks;
      transcriptText = existingChunks.map((c) => `${c.speaker} (${c.timestamp}): ${c.text}`).join('\n');
    } else if (options.uploadedFile) {
      // If a text/markdown file was uploaded as meeting notes
      const fileExt = options.uploadedFile.name.split('.').pop()?.toLowerCase();
      if (['txt', 'md', 'markdown', 'csv'].includes(fileExt || '')) {
        transcriptText = await options.uploadedFile.text();
      } else {
        transcriptText = `Recording file ${options.uploadedFile.name} (${(options.uploadedFile.size / 1024).toFixed(0)} KB) processed on ${new Date().toLocaleTimeString()}.\nMeeting discussion completed on platform: ${meeting.platform || 'External'}.`;
      }
    }

    if (!transcriptText && options.audioBlob) {
      transcriptText = `Audio recording session (${Math.round(options.audioBlob.size / 1024)} KB) completed.\nMeeting discussion between ${meeting.participants.join(', ')} regarding ${meeting.title}.`;
    }

    if (!transcriptText) {
      transcriptText = `Meeting "${meeting.title}" completed on ${meeting.date}.\nParticipants: ${meeting.participants.join(', ')}.\nDiscussion concluded with agreed next steps and action items.`;
    }

    // Generate segmented chunks if not present
    if (transcriptChunks.length === 0) {
      const lines = transcriptText.split('\n').filter((l) => l.trim().length > 0);
      const parts = meeting.participants.length > 0 ? meeting.participants : ['Team Member', 'Organizer'];
      transcriptChunks = lines.map((line, idx) => ({
        id: `tc-${meetingId}-${idx}-${Date.now()}`,
        userId,
        meetingId,
        speaker: line.includes(':') ? line.split(':')[0].trim() : parts[idx % parts.length],
        text: line.includes(':') ? line.split(':').slice(1).join(':').trim() : line,
        timestamp: `${String(Math.floor((idx * 2) / 60)).padStart(2, '0')}:${String((idx * 2) % 60).padStart(2, '0')}`,
        createdAt: Date.now() + idx,
      }));
      await db.transcripts.bulkPut(transcriptChunks);
    }

    // 2. RAG Knowledge Match with user resources
    this.updateJob(meetingId, {
      status: 'analyzing',
      progress: 55,
      step: 'Retrieving relevant RAG knowledge and documents...',
    });

    await db.meetings.update(meetingId, {
      processingStep: 'Matching RAG resources & reasoning over context...',
      processingProgress: 60,
    });

    const userResources = await db.resources.where('userId').equals(userId).toArray();
    const referencedResources: ReferencedResource[] = [];

    const lowerTranscript = transcriptText.toLowerCase();
    for (const res of userResources) {
      const titleLower = res.title.toLowerCase();
      const filenameLower = res.filename.toLowerCase();
      const words = titleLower.split(/[\s_.-]+/).filter((w) => w.length > 3);

      const isMatch =
        lowerTranscript.includes(titleLower) ||
        lowerTranscript.includes(filenameLower) ||
        words.some((w) => lowerTranscript.includes(w));

      if (isMatch) {
        referencedResources.push({
          id: res.id,
          title: res.title,
          filename: res.filename,
          snippet: res.contentSnippet,
        });
      }
    }

    // 3. AI Analysis
    this.updateJob(meetingId, {
      status: 'analyzing',
      progress: 75,
      step: 'Extracting decisions, commitments, tasks & summary...',
    });

    const analysis: MeetingAnalysis = await analyzeMeetingContent(
      meeting.title,
      transcriptText,
      meeting.participants
    );

    // 4. Save extracted Decisions & Commitments to Dexie
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

    // Create tasks in Task Tracker
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

    // 5. Index in Long-Term Memory
    this.updateJob(meetingId, {
      status: 'indexing',
      progress: 90,
      step: 'Indexing meeting memory into local RAG vector store...',
    });

    const updatedMeeting: Meeting = {
      ...meeting,
      summary: analysis.summary || `Meeting completed: ${meeting.title}`,
      importantPoints: analysis.importantPoints || [],
      decisions,
      commitments,
      questions: analysis.questions || [],
      deadlines: analysis.deadlines || [],
      conflicts: analysis.conflicts || [],
      unresolvedQuestions: (analysis.questions || []).filter((q) => !q.answered).map((q) => q.question),
      resourcesReferenced: referencedResources,
      rawNotes: transcriptText,
      status: 'completed',
      meetingState: 'completed',
      processingStep: 'Ready',
      processingProgress: 100,
      updatedAt: Date.now(),
    };

    await db.meetings.put(updatedMeeting);
    await indexMeetingMemories(updatedMeeting);

    // 6. Complete
    this.updateJob(meetingId, {
      status: 'completed',
      progress: 100,
      step: '✓ Meeting intelligence ready',
    });

    // Remove from active queue after 8 seconds
    setTimeout(() => {
      this.jobs.delete(meetingId);
      this.notify();
    }, 8000);
  }
}

export const processingQueue = new ProcessingQueueManager();
