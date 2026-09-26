import { db } from '../db';
import { resourceIngestion } from '../services/resourceIngestion';
import { formatLocalDate } from '../utils/dateUtils';
import { Decision, Commitment, TaskItem, Meeting, CalendarEvent, ResourceDocument, TranscriptChunk } from '../types';

export const AgentToolRegistry = {
  /**
   * Search meetings scoped by userId.
   */
  async searchMeetings(userId: string, query?: string): Promise<Meeting[]> {
    if (!userId) return [];
    let meetings = await db.meetings.where('userId').equals(userId).toArray();
    if (!query || !query.trim()) return meetings;
    const q = query.toLowerCase();
    return meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        (m.rawNotes && m.rawNotes.toLowerCase().includes(q)) ||
        m.participants.some((p) => p.toLowerCase().includes(q))
    );
  },

  /**
   * Get specific meeting details by ID and userId.
   */
  async getMeeting(userId: string, meetingId: string): Promise<Meeting | undefined> {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting || (meeting.userId && meeting.userId !== userId)) return undefined;
    return meeting;
  },

  /**
   * Search uploaded RAG resources by filename, title, or content using vector cosine similarity.
   */
  async searchResources(userId: string, query?: string): Promise<ResourceDocument[]> {
    if (!userId) return [];
    if (!query || !query.trim()) {
      return await db.resources.where('userId').equals(userId).toArray();
    }
    const chunks = await resourceIngestion.searchResources(query, 5, userId);
    const docIds = Array.from(new Set(chunks.map((c) => c.chunk.resourceId)));
    const docs: ResourceDocument[] = [];
    for (const id of docIds) {
      const doc = await db.resources.get(id);
      if (doc && doc.userId === userId) docs.push(doc);
    }
    return docs;
  },

  /**
   * Search top relevant chunks from RAG resources with similarity scores.
   */
  async searchResourceChunks(userId: string, query: string, topK = 4) {
    if (!userId || !query.trim()) return [];
    return await resourceIngestion.searchResources(query, topK, userId);
  },

  /**
   * Query recorded architectural and product decisions scoped by userId.
   */
  async getDecisions(userId: string, topic?: string): Promise<Decision[]> {
    if (!userId) return [];
    let decisions = await db.decisions.where('userId').equals(userId).toArray();
    if (!topic || !topic.trim()) return decisions;
    const query = topic.toLowerCase();
    return decisions.filter(
      (d) =>
        d.decision.toLowerCase().includes(query) ||
        (d.reason && d.reason.toLowerCase().includes(query)) ||
        (d.sourceMeetingTitle && d.sourceMeetingTitle.toLowerCase().includes(query))
    );
  },

  /**
   * Query commitments and action items scoped by userId.
   */
  async getCommitments(userId: string, owner?: string, status?: string): Promise<Commitment[]> {
    if (!userId) return [];
    let commitments = await db.commitments.where('userId').equals(userId).toArray();
    if (owner && owner.trim()) {
      const o = owner.toLowerCase();
      commitments = commitments.filter((c) => c.owner.toLowerCase().includes(o));
    }
    if (status && status.trim()) {
      commitments = commitments.filter((c) => c.status === status);
    }
    return commitments;
  },

  /**
   * Query tasks scoped by userId.
   */
  async searchTasks(userId: string, query?: string): Promise<TaskItem[]> {
    if (!userId) return [];
    let tasks = await db.tasks.where('userId').equals(userId).toArray();
    if (!query || !query.trim()) return tasks;
    const q = query.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
    );
  },

  /**
   * Get upcoming meetings strictly after or on today's local date.
   */
  async getUpcomingMeetings(userId: string): Promise<Meeting[]> {
    if (!userId) return [];
    const todayStr = formatLocalDate(new Date());
    const meetings = await db.meetings.where('userId').equals(userId).toArray();
    return meetings
      .filter((m) => m.date >= todayStr && m.meetingState !== 'completed' && m.status !== 'completed')
      .sort((a, b) => (a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date)));
  },

  /**
   * Get past processed meetings.
   */
  async getPastMeetings(userId: string): Promise<Meeting[]> {
    if (!userId) return [];
    const meetings = await db.meetings.where('userId').equals(userId).toArray();
    return meetings
      .filter((m) => m.meetingState === 'completed' || m.status === 'completed')
      .sort((a, b) => (b.date === a.date ? (b.startTime || '').localeCompare(a.startTime || '') : b.date.localeCompare(a.date)));
  },

  /**
   * Get today's meetings.
   */
  async getTodaysMeetings(userId: string): Promise<Meeting[]> {
    if (!userId) return [];
    const todayStr = formatLocalDate(new Date());
    const meetings = await db.meetings.where('userId').equals(userId).toArray();
    return meetings
      .filter((m) => m.date === todayStr)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  },

  /**
   * Search transcript chunks scoped by userId.
   */
  async searchTranscripts(userId: string, query: string): Promise<TranscriptChunk[]> {
    if (!userId || !query.trim()) return [];
    const chunks = await db.transcripts.where('userId').equals(userId).toArray();
    const q = query.toLowerCase();
    return chunks.filter((c) => c.text.toLowerCase().includes(q) || c.speaker.toLowerCase().includes(q));
  },
};
