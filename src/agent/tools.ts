import { db } from '../db';
import { searchLocalMemory, RetrievedMemoryItem } from '../services/memory';
import { checkSlotAvailability, createCalendarEvent, SchedulingRecommendation } from '../services/calendar';
import { evaluateDelegatePermission, PermissionCheckResult, SensitiveActionType } from '../services/permissions';
import { Decision, Commitment, TaskItem, Meeting, CalendarEvent, ResourceDocument, TranscriptChunk } from '../types';

export const AgentToolRegistry = {
  /**
   * Search local meeting memory, decisions, and commitments.
   */
  async searchMemory(query: string): Promise<{ items: RetrievedMemoryItem[]; summary: string }> {
    const items = await searchLocalMemory(query, 6);
    const summary = items.length > 0
      ? `Retrieved ${items.length} relevant memory records from local IndexedDB.`
      : 'No matching memory records found for query.';
    return { items, summary };
  },

  /**
   * Get specific meeting details by ID.
   */
  async getMeeting(meetingId: string): Promise<Meeting | undefined> {
    return await db.meetings.get(meetingId);
  },

  /**
   * Search all meetings by title, notes, summary, or participant.
   */
  async searchMeetings(query?: string): Promise<Meeting[]> {
    const meetings = await db.meetings.toArray();
    if (!query) return meetings;
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
   * Search transcript chunks across all meetings.
   */
  async searchTranscript(query: string): Promise<TranscriptChunk[]> {
    const chunks = await db.transcripts.toArray();
    const q = query.toLowerCase();
    return chunks.filter(
      (c) => c.text.toLowerCase().includes(q) || c.speaker.toLowerCase().includes(q)
    );
  },

  /**
   * Search uploaded RAG resources by filename, title, or content.
   */
  async searchResources(query?: string): Promise<ResourceDocument[]> {
    const resources = await db.resources.toArray();
    if (!query) return resources;
    const q = query.toLowerCase();
    return resources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.filename.toLowerCase().includes(q) ||
        r.contentSnippet.toLowerCase().includes(q) ||
        (r.rawText && r.rawText.toLowerCase().includes(q))
    );
  },

  /**
   * Query recorded architectural and product decisions.
   */
  async getDecision(topic?: string): Promise<Decision[]> {
    const decisions = await db.decisions.toArray();
    if (!topic) return decisions;
    const query = topic.toLowerCase();
    return decisions.filter(
      (d) =>
        d.decision.toLowerCase().includes(query) ||
        (d.reason && d.reason.toLowerCase().includes(query)) ||
        (d.sourceMeetingTitle && d.sourceMeetingTitle.toLowerCase().includes(query))
    );
  },

  /**
   * Query commitments and action items (e.g. by owner or overdue status).
   */
  async getCommitments(owner?: string, status?: string): Promise<Commitment[]> {
    let commitments = await db.commitments.toArray();
    if (owner) {
      const o = owner.toLowerCase();
      commitments = commitments.filter((c) => c.owner.toLowerCase().includes(o));
    }
    if (status) {
      commitments = commitments.filter((c) => c.status === status);
    }
    return commitments;
  },

  /**
   * Query pending or overdue tasks.
   */
  async getTasks(assignee?: string, status?: string): Promise<TaskItem[]> {
    let tasks = await db.tasks.toArray();
    if (assignee) {
      const a = assignee.toLowerCase();
      tasks = tasks.filter((t) => t.assignee.toLowerCase().includes(a));
    }
    if (status) {
      tasks = tasks.filter((t) => t.status === status);
    }
    return tasks;
  },

  /**
   * Query calendar events.
   */
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    return await db.calendarEvents.toArray();
  },

  /**
   * Get upcoming meetings.
   */
  async getUpcomingMeetings(): Promise<Meeting[]> {
    const today = new Date().toISOString().split('T')[0];
    const meetings = await db.meetings.toArray();
    return meetings.filter(
      (m) => m.date >= today && m.meetingState !== 'completed' && m.status !== 'completed'
    );
  },

  /**
   * Get past meetings.
   */
  async getPastMeetings(): Promise<Meeting[]> {
    const meetings = await db.meetings.toArray();
    return meetings.filter(
      (m) => m.meetingState === 'completed' || m.status === 'completed'
    );
  },

  /**
   * Get unresolved items across all meetings.
   */
  async getUnresolvedItems(): Promise<Array<{ meetingTitle: string; question: string }>> {
    const meetings = await db.meetings.toArray();
    const list: Array<{ meetingTitle: string; question: string }> = [];
    for (const m of meetings) {
      if (m.unresolvedQuestions) {
        for (const q of m.unresolvedQuestions) {
          list.push({ meetingTitle: m.title, question: q });
        }
      }
      if (m.questions) {
        for (const q of m.questions.filter((item) => !item.answered)) {
          list.push({ meetingTitle: m.title, question: q.question });
        }
      }
    }
    return list;
  },

  /**
   * Check calendar availability and detect conflicts.
   */
  async checkAvailability(
    participants: string[],
    date: string,
    startTime: string,
    durationMinutes = 30
  ): Promise<SchedulingRecommendation> {
    return await checkSlotAvailability(participants, date, startTime, durationMinutes);
  },

  /**
   * Create a scheduled calendar meeting.
   */
  async createMeeting(
    title: string,
    participants: string[],
    start: string,
    end: string
  ): Promise<CalendarEvent> {
    return await createCalendarEvent(title, participants, start, end);
  },

  /**
   * Create a new task item in the task tracker.
   */
  async createTask(
    title: string,
    assignee: string,
    deadline?: string,
    sourceMeetingId?: string,
    sourceMeetingTitle?: string
  ): Promise<TaskItem> {
    const task: TaskItem = {
      id: `task-${Date.now()}`,
      title,
      assignee,
      deadline,
      status: 'todo',
      priority: 'high',
      sourceMeetingId,
      sourceMeetingTitle,
      createdAt: Date.now(),
    };
    await db.tasks.put(task);
    return task;
  },

  /**
   * Update task status (e.g. 'done', 'in-progress', 'todo').
   */
  async updateTask(taskId: string, status: 'todo' | 'in-progress' | 'done'): Promise<TaskItem | undefined> {
    const task = await db.tasks.get(taskId);
    if (!task) return undefined;
    task.status = status;
    await db.tasks.put(task);
    return task;
  },

  /**
   * Check permission for sensitive delegate actions.
   */
  async checkPermission(action: SensitiveActionType, details?: any): Promise<PermissionCheckResult> {
    const settings = await db.settings.get('current_settings');
    const permissions = settings?.permissions || {
      canAnswerQuestions: true,
      canRetrieveHistory: true,
      canTakeNotes: true,
      canCreateTasks: true,
      canAcceptTasks: false,
      canChangeDeadlines: false,
      canMakeTechnicalDecisions: false,
      canScheduleMeetings: false,
    };
    return evaluateDelegatePermission(action, permissions, details);
  },

  /**
   * Retrieve minimal, relevant delegate context without database stuffing.
   */
  async getDelegateContext(query: string): Promise<{
    relevantDecisions: Decision[];
    relevantCommitments: Commitment[];
    userPreferences: string;
  }> {
    const settings = await db.settings.get('current_settings');
    const memories = await searchLocalMemory(query, 3);
    const relevantDecisions: Decision[] = [];
    const relevantCommitments: Commitment[] = [];

    for (const mem of memories) {
      if (mem.category === 'decision') {
        const dec = await db.decisions.get(mem.id);
        if (dec) relevantDecisions.push(dec);
      } else if (mem.category === 'commitment') {
        const com = await db.commitments.get(mem.id);
        if (com) relevantCommitments.push(com);
      }
    }

    return {
      relevantDecisions,
      relevantCommitments,
      userPreferences: settings?.userProfile.preferences || '',
    };
  },
};
