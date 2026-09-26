export type Priority = 'low' | 'medium' | 'high';
export type CommitmentStatus = 'pending' | 'completed' | 'overdue' | 'uncertain';
export type DecisionStatus = 'active' | 'superseded';
export type TaskStatus = 'todo' | 'in-progress' | 'done';

export type MeetingPlatform =
  | 'google_meet'
  | 'zoom'
  | 'teams'
  | 'in_person'
  | 'discord'
  | 'phone'
  | 'other';

export type RecordingState =
  | 'scheduled'
  | 'ready'
  | 'requesting_permission'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'processing'
  | 'processed'
  | 'failed';

export type MeetingLifecycleState =
  | 'scheduled'
  | 'ready'
  | 'requesting_permission'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'upcoming'
  | 'starting'
  | 'live'
  | 'ending'
  | 'completed'
  | 'no_recording'
  | 'cancelled';

export type RecordingMode = 'automatic' | 'manual' | 'upload_later' | 'disabled';

export interface ImportantPoint {
  id: string;
  point: string;
  category?: string;
}

export interface Decision {
  id: string;
  userId?: string;
  decision: string;
  reason?: string;
  alternatives?: string[];
  participants: string[];
  sourceMeetingId: string;
  sourceMeetingTitle?: string;
  date: string;
  status: DecisionStatus;
}

export interface Commitment {
  id: string;
  userId?: string;
  owner: string;
  task: string;
  deadline?: string;
  sourceMeetingId: string;
  sourceMeetingTitle?: string;
  status: CommitmentStatus;
  confidence: number;
  priority?: Priority;
}

export interface Question {
  id: string;
  question: string;
  askedBy?: string;
  answered: boolean;
  answer?: string;
}

export interface Deadline {
  id: string;
  task: string;
  owner: string;
  date: string;
}

export interface Conflict {
  id: string;
  description: string;
  involvedParties: string[];
  resolution?: string;
}

export interface ReferencedResource {
  id: string;
  title: string;
  filename: string;
  snippet: string;
}

export interface MeetingAnalysis {
  summary: string;
  importantPoints: ImportantPoint[];
  decisions: Decision[];
  commitments: Commitment[];
  questions: Question[];
  deadlines: Deadline[];
  conflicts: Conflict[];
  unresolvedQuestions?: string[];
  resourcesReferenced?: ReferencedResource[];
}

export interface TranscriptChunk {
  id: string;
  userId?: string;
  meetingId: string;
  timestamp: string; // e.g. "04:12"
  speaker: string;
  text: string;
  createdAt: number;
}

export interface Meeting {
  id: string;
  userId?: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // e.g. "10:00"
  endTime?: string;   // e.g. "10:45"
  durationMinutes: number;
  platform?: MeetingPlatform;
  meetingLink?: string;
  meetingUrl?: string; // alias for meetingLink
  recordingId?: string;
  participants: string[];
  summary: string;
  importantPoints: ImportantPoint[];
  decisions: Decision[];
  commitments: Commitment[];
  questions: Question[];
  deadlines: Deadline[];
  conflicts: Conflict[];
  unresolvedQuestions?: string[];
  resourcesReferenced?: ReferencedResource[];
  rawNotes?: string;
  audioBlobUrl?: string;
  audioBlob?: Blob;
  status: 'completed' | 'in-progress' | 'scheduled';
  meetingState?: MeetingLifecycleState;
  recordingMode?: RecordingMode;
  processingStep?: string; // e.g. "Transcribing audio...", "Reasoning over meeting...", "Ready"
  processingProgress?: number; // 0 to 100
  location?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MeetingRecording {
  recordingId: string;
  meetingId: string;
  userId: string;
  mimeType: string;
  size: number;
  duration: number; // in seconds
  createdAt: number;
  blob: Blob;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarColor: string;
}

export interface CalendarEvent {
  id: string;
  userId?: string;
  title: string;
  participants: string[];
  start: string; // ISO e.g. "2026-09-27T16:00:00"
  end: string;   // ISO e.g. "2026-09-27T16:30:00"
  sourceMeetingId?: string;
  platform?: MeetingPlatform;
  meetingLink?: string;
  location?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  meetingState?: MeetingLifecycleState;
}

export type ResourceCategory =
  | 'All'
  | 'Projects'
  | 'Work'
  | 'Personal'
  | 'Technical'
  | 'Meeting Material'
  | 'Other';

export interface ResourceDocument {
  id: string;
  userId?: string;
  name: string;
  title: string;
  filename: string;
  originalFileName: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'pptx' | 'other';
  mimeType?: string;
  sizeBytes: number;
  uploadedAt: string;
  updatedAt?: number;
  description?: string;
  category?: ResourceCategory | string;
  tags?: string[];
  status: 'indexed' | 'processing' | 'extracting' | 'embedding_incomplete' | 'failed' | 'error';
  error?: string;
  contentSnippet: string;
  rawText?: string;
  chunkCount: number;
  pageCount?: number;
  sourceCategory?: string;
}

export interface ResourceChunk {
  id: string;
  userId: string;
  resourceId: string;
  resourceTitle: string;
  filename: string;
  text: string;
  index: number;
  pageNumber?: number;
  heading?: string;
  section?: string;
  tokenCount?: number;
  embedding?: number[];
  createdAt: number;
}

export interface ResourceFileRecord {
  id: string;
  userId: string;
  resourceId: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

export interface MemoryEntry {
  id: string;
  userId?: string;
  category: 'decision' | 'commitment' | 'fact' | 'summary' | 'preference' | 'resource';
  content: string;
  sourceMeetingId?: string;
  sourceMeetingTitle: string;
  resourceId?: string;
  timestamp: string;
  keywords: string[];
  embedding?: number[];
  createdAt: number;
}

export interface TaskItem {
  id: string;
  userId?: string;
  title: string;
  assignee: string;
  deadline?: string;
  status: TaskStatus;
  priority: Priority;
  sourceMeetingId?: string;
  sourceMeetingTitle?: string;
  notes?: string;
  createdAt: number;
}

export interface DelegatePermissions {
  canAnswerQuestions: boolean;
  canRetrieveHistory: boolean;
  canTakeNotes: boolean;
  canCreateTasks: boolean;
  canAcceptTasks: boolean;
  canChangeDeadlines: boolean;
  canMakeTechnicalDecisions: boolean;
  canScheduleMeetings: boolean;
}

export interface DelegateActionReport {
  answeredQuestions: number;
  recordedDecisions: number;
  createdTasks: number;
  refusedActions: number;
  details: Array<{
    type: 'answer' | 'decision' | 'task' | 'refusal' | 'note';
    summary: string;
    timestamp: string;
    evidence?: string;
  }>;
}

export interface DelegateBriefing {
  meetingTitle: string;
  duration: string;
  important: string[];
  decisions: string[];
  commitments: Array<{ owner: string; task: string; deadline?: string }>;
  needsAttention: Array<{ id: string; message: string; severity: 'high' | 'medium' | 'low'; actionRequired: string }>;
  unresolved: string[];
  actionsTaken: DelegateActionReport;
}

export interface DelegateSession {
  id: string;
  userId?: string;
  meetingTitle: string;
  date: string;
  participants: string[];
  briefing: DelegateBriefing;
  transcript: TranscriptChunk[];
  permissionsUsed: DelegatePermissions;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  timezone: string;
  preferences: string;
}

export interface AppSettings {
  id: string;
  userId?: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  embeddingModel: string;
  userProfile: UserProfile;
  permissions: DelegatePermissions;
  autoSchedule: boolean;
  recordingMode: RecordingMode;
  micPermissionGranted: boolean;
  voiceEnabled: boolean;
  ttsEnabled: boolean;
}

export interface AgentEvidence {
  inputs: Record<string, any>;
  retrievedSources: Array<{ id: string; title: string; snippet: string; type?: 'meeting' | 'resource' }>;
  constraints: string[];
  selectedAction: string;
  rationale: string;
  timestamp: number;
}

export interface AgentResponse {
  message: string;
  evidence?: AgentEvidence;
  actionTaken?: string;
  suggestedFollowUps?: string[];
  actionPayload?: any;
}
