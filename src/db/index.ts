import Dexie, { Table } from 'dexie';
import {
  Meeting,
  TranscriptChunk,
  Decision,
  Commitment,
  TaskItem,
  Person,
  CalendarEvent,
  ResourceDocument,
  MemoryEntry,
  DelegateSession,
  AppSettings,
  DelegatePermissions,
} from '../types';

export const DEFAULT_PERMISSIONS: DelegatePermissions = {
  canAnswerQuestions: true,
  canRetrieveHistory: true,
  canTakeNotes: true,
  canCreateTasks: true,
  canAcceptTasks: false,        // ASK
  canChangeDeadlines: false,     // ASK / REFUSE
  canMakeTechnicalDecisions: false, // DENY
  canScheduleMeetings: false,   // ASK
};

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'current_settings',
  userId: 'default_user',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'qwen3:8b',
  embeddingModel: 'qwen3-embedding:0.6b',
  userProfile: {
    uid: 'default_user',
    name: 'User',
    role: 'Member',
    email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    preferences: '',
  },
  permissions: DEFAULT_PERMISSIONS,
  autoSchedule: false,
  recordingMode: 'manual',
  micPermissionGranted: false,
  voiceEnabled: true,
  ttsEnabled: false,
};

export class MeetingMindDatabase extends Dexie {
  meetings!: Table<Meeting, string>;
  transcripts!: Table<TranscriptChunk, string>;
  decisions!: Table<Decision, string>;
  commitments!: Table<Commitment, string>;
  tasks!: Table<TaskItem, string>;
  people!: Table<Person, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  resources!: Table<ResourceDocument, string>;
  resourceFiles!: Table<{ id: string; userId: string; resourceId: string; blob: Blob; filename: string; mimeType: string; sizeBytes: number; createdAt: number }, string>;
  resourceChunks!: Table<{ id: string; userId: string; resourceId: string; resourceTitle: string; filename: string; text: string; index: number; pageNumber?: number; heading?: string; section?: string; tokenCount?: number; createdAt: number }, string>;
  memories!: Table<MemoryEntry, string>;
  delegateSessions!: Table<DelegateSession, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('MeetingMindLocalDB');
    this.version(4).stores({
      meetings: 'id, userId, title, date, status, meetingState, createdAt',
      transcripts: 'id, userId, meetingId, timestamp, speaker, createdAt',
      decisions: 'id, userId, sourceMeetingId, status, date',
      commitments: 'id, userId, owner, status, sourceMeetingId, deadline',
      tasks: 'id, userId, assignee, status, priority, sourceMeetingId',
      people: 'id, name, email',
      calendarEvents: 'id, userId, start, end, status',
      resources: 'id, userId, filename, name, fileType, category, status, uploadedAt',
      resourceFiles: 'id, userId, resourceId',
      resourceChunks: 'id, userId, resourceId, index, heading',
      memories: 'id, userId, category, sourceMeetingId, resourceId, timestamp',
      delegateSessions: 'id, userId, meetingTitle, date, createdAt',
      settings: 'id, userId',
    });
  }
}

export const db = new MeetingMindDatabase();

export async function ensureSettings(userId = 'default_user'): Promise<AppSettings> {
  const existing = await db.settings.get('current_settings');
  if (existing) {
    return existing;
  }
  const s = { ...DEFAULT_SETTINGS, userId };
  await db.settings.put(s);
  return s;
}
