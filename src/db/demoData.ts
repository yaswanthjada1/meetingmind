import { db, DEFAULT_SETTINGS } from './index';
import {
  Meeting,
  TranscriptChunk,
  Decision,
  Commitment,
  TaskItem,
  Person,
  CalendarEvent,
  ResourceDocument,
  DelegateSession,
} from '../types';
import { DEMO_RESOURCES } from '../services/resources';

export const DEMO_PEOPLE: Person[] = [
  {
    id: 'p-yaswanth',
    name: 'Yaswanth',
    role: 'Lead Architect & Engineering Lead',
    email: 'yaswanth@company.internal',
    avatarColor: '#18181B',
  },
  {
    id: 'p-rahul',
    name: 'Rahul',
    role: 'Senior Backend Engineer',
    email: 'rahul@company.internal',
    avatarColor: '#52525B',
  },
  {
    id: 'p-priya',
    name: 'Priya',
    role: 'Frontend & UI/UX Lead',
    email: 'priya@company.internal',
    avatarColor: '#71717A',
  },
  {
    id: 'p-alex',
    name: 'Alex',
    role: 'DevOps & Platform Engineer',
    email: 'alex@company.internal',
    avatarColor: '#3F3F46',
  },
];

export const DEMO_MEETINGS: Meeting[] = [
  {
    id: 'meet-alpha-arch-26',
    userId: 'default_user',
    title: 'Project Alpha — Architecture Review',
    date: '2026-09-26',
    startTime: '10:00',
    endTime: '10:45',
    durationMinutes: 45,
    participants: ['Yaswanth', 'Rahul', 'Priya'],
    summary: 'Detailed architecture review discussing persistent database storage, authentication protocols, and release cadence for Project Alpha.',
    importantPoints: [
      { id: 'ip-1', point: 'PostgreSQL remains the selected database due to ACID guarantees and robust JSONB support.', category: 'Architecture' },
      { id: 'ip-2', point: 'API deployment moved to Friday to accommodate end-to-end security audits.', category: 'Timeline' },
      { id: 'ip-3', point: 'Client-side state management should favor local-first persistence.', category: 'Frontend' },
    ],
    decisions: [
      {
        id: 'dec-1',
        userId: 'default_user',
        decision: 'Use JWT authentication with short-lived tokens and secure refresh cookies.',
        reason: 'Stateless validation minimizes database lookups on microservices.',
        alternatives: ['Server-side Session IDs in Redis', 'OAuth2 third-party only'],
        participants: ['Yaswanth', 'Rahul', 'Priya'],
        sourceMeetingId: 'meet-alpha-arch-26',
        sourceMeetingTitle: 'Project Alpha — Architecture Review',
        date: '2026-09-26',
        status: 'active',
      },
      {
        id: 'dec-2',
        userId: 'default_user',
        decision: 'PostgreSQL selected as primary database over NoSQL/MongoDB.',
        reason: 'Complex relational schemas and regulatory audit compliance required ACID.',
        alternatives: ['MongoDB', 'MySQL 8.0'],
        participants: ['Yaswanth', 'Rahul'],
        sourceMeetingId: 'meet-alpha-arch-26',
        sourceMeetingTitle: 'Project Alpha — Architecture Review',
        date: '2026-09-26',
        status: 'active',
      },
    ],
    commitments: [
      {
        id: 'com-1',
        userId: 'default_user',
        owner: 'Rahul',
        task: 'Implement JWT authentication & middleware validators',
        deadline: '2026-10-02', // Friday
        sourceMeetingId: 'meet-alpha-arch-26',
        sourceMeetingTitle: 'Project Alpha — Architecture Review',
        status: 'pending',
        confidence: 0.95,
        priority: 'high',
      },
      {
        id: 'com-2',
        userId: 'default_user',
        owner: 'Priya',
        task: 'Complete responsive UI prototype for meeting dashboard and notepad',
        deadline: '2026-09-30', // Wednesday
        sourceMeetingId: 'meet-alpha-arch-26',
        sourceMeetingTitle: 'Project Alpha — Architecture Review',
        status: 'completed',
        confidence: 0.9,
        priority: 'medium',
      },
    ],
    questions: [
      { id: 'q-1', question: 'Should we containerize the local dev environment with Docker Compose?', askedBy: 'Rahul', answered: true, answer: 'Yes, Alex will prepare the Dockerfile.' },
      { id: 'q-2', question: 'Deployment environment still undecided between AWS ECS and fly.io.', askedBy: 'Yaswanth', answered: false },
    ],
    deadlines: [
      { id: 'dl-1', task: 'JWT Auth Implementation', owner: 'Rahul', date: '2026-10-02' },
      { id: 'dl-2', task: 'UI Prototype', owner: 'Priya', date: '2026-09-30' },
    ],
    conflicts: [],
    rawNotes: `Project Alpha — Architecture Review\n26 September 2026 · 10:00 AM · 45 min\n\nParticipants:\nYaswanth, Rahul, Priya\n\nImportant:\n• PostgreSQL remains the selected database.\n• API deployment moved to Friday.\n\nDecisions:\n• Use JWT authentication.\n• Keep local-first principles intact.\n\nCommitments:\nRahul → Implement authentication → Friday\nPriya → UI prototype → Wednesday\n\nUnresolved:\n• Deployment environment still undecided between ECS and bare metal.`,
    status: 'completed',
    createdAt: Date.now() - 1000 * 60 * 60 * 4,
    updatedAt: Date.now() - 1000 * 60 * 60 * 4,
  },
  {
    id: 'meet-alpha-api-24',
    userId: 'default_user',
    title: 'Project Alpha — API & Backend Sync',
    date: '2026-09-24',
    startTime: '14:00',
    endTime: '14:35',
    durationMinutes: 35,
    participants: ['Yaswanth', 'Rahul', 'Alex'],
    summary: 'Discussion regarding API endpoint structure, rate limiting strategies, and overdue middleware documentation.',
    importantPoints: [
      { id: 'ip-4', point: 'Rate limiting on public endpoints to be capped at 100 req/min per IP.', category: 'Security' },
      { id: 'ip-5', point: 'Token refresh endpoint needs strict replay prevention.', category: 'Security' },
    ],
    decisions: [
      {
        id: 'dec-3',
        userId: 'default_user',
        decision: 'Access token expiration set to 15 minutes; refresh token rotation enabled.',
        reason: 'Mitigates token leakage risks while preventing constant re-login prompts.',
        participants: ['Yaswanth', 'Rahul', 'Alex'],
        sourceMeetingId: 'meet-alpha-api-24',
        sourceMeetingTitle: 'Project Alpha — API & Backend Sync',
        date: '2026-09-24',
        status: 'active',
      },
    ],
    commitments: [
      {
        id: 'com-3',
        userId: 'default_user',
        owner: 'Rahul',
        task: 'Deliver API Rate Limiting specification document & headers draft',
        deadline: '2026-09-25', // Overdue!
        sourceMeetingId: 'meet-alpha-api-24',
        sourceMeetingTitle: 'Project Alpha — API & Backend Sync',
        status: 'overdue',
        confidence: 0.98,
        priority: 'high',
      },
      {
        id: 'com-4',
        userId: 'default_user',
        owner: 'Alex',
        task: 'Setup PostgreSQL migrations runner & seed scripts',
        deadline: '2026-09-28',
        sourceMeetingId: 'meet-alpha-api-24',
        sourceMeetingTitle: 'Project Alpha — API & Backend Sync',
        status: 'pending',
        confidence: 0.88,
        priority: 'medium',
      },
    ],
    questions: [
      { id: 'q-3', question: 'Will Redis be required for blacklisting invalidated JWT tokens?', askedBy: 'Rahul', answered: false },
    ],
    deadlines: [
      { id: 'dl-3', task: 'Rate Limiting Spec', owner: 'Rahul', date: '2026-09-25' },
    ],
    conflicts: [],
    rawNotes: `Project Alpha — API & Backend Sync\n24 September 2026\n\nParticipants: Yaswanth, Rahul, Alex\n\nDecisions:\n• Token expiry set to 15m.\n\nCommitments:\nRahul → API Rate Limiting Spec → 25 Sept (OVERDUE)\nAlex → Schema migrations → 28 Sept`,
    status: 'completed',
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    updatedAt: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: 'meet-alpha-plan-22',
    userId: 'default_user',
    title: 'Sprint Planning & Roadmap Review',
    date: '2026-09-22',
    startTime: '11:00',
    endTime: '11:50',
    durationMinutes: 50,
    participants: ['Yaswanth', 'Priya', 'Rahul', 'Alex'],
    summary: 'Kickoff planning session establishing architectural constraints, technology stack choices, and milestone deadlines.',
    importantPoints: [
      { id: 'ip-6', point: 'Local-first architecture chosen for meeting notes and offline capabilities.', category: 'Product' },
      { id: 'ip-7', point: 'Target prototype milestone set for early October.', category: 'Timeline' },
    ],
    decisions: [
      {
        id: 'dec-4',
        userId: 'default_user',
        decision: 'Selected React + Tailwind CSS + Dexie.js for the core web application.',
        reason: 'Enables ultra-fast local indexing and zero server latency for the user.',
        participants: ['Yaswanth', 'Priya', 'Rahul', 'Alex'],
        sourceMeetingId: 'meet-alpha-plan-22',
        sourceMeetingTitle: 'Sprint Planning & Roadmap Review',
        date: '2026-09-22',
        status: 'active',
      },
    ],
    commitments: [
      {
        id: 'com-5',
        userId: 'default_user',
        owner: 'Priya',
        task: 'Setup Tailwind design tokens & typography palette',
        deadline: '2026-09-23',
        sourceMeetingId: 'meet-alpha-plan-22',
        sourceMeetingTitle: 'Sprint Planning & Roadmap Review',
        status: 'completed',
        confidence: 0.95,
        priority: 'medium',
      },
      {
        id: 'com-6',
        userId: 'default_user',
        owner: 'Yaswanth',
        task: 'Review infrastructure budget & local LLM requirements',
        deadline: '2026-09-30',
        sourceMeetingId: 'meet-alpha-plan-22',
        sourceMeetingTitle: 'Sprint Planning & Roadmap Review',
        status: 'pending',
        confidence: 0.85,
        priority: 'low',
      },
    ],
    questions: [],
    deadlines: [
      { id: 'dl-4', task: 'Design Tokens', owner: 'Priya', date: '2026-09-23' },
    ],
    conflicts: [],
    rawNotes: `Sprint Planning & Roadmap Review\n22 September 2026\n\nParticipants: All team\n\nDecisions:\n• React + Tailwind + Dexie.js\n\nCommitments:\nPriya → Design tokens → 23 Sept (Done)\nYaswanth → Infrastructure review → 30 Sept`,
    status: 'completed',
    createdAt: Date.now() - 1000 * 60 * 60 * 96,
    updatedAt: Date.now() - 1000 * 60 * 60 * 96,
  },
];

export const DEMO_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'cal-meet-alpha-arch-26',
    userId: 'default_user',
    title: 'Project Alpha — Architecture Review',
    participants: ['Yaswanth', 'Rahul', 'Priya'],
    start: '2026-09-26T10:00:00',
    end: '2026-09-26T10:45:00',
    sourceMeetingId: 'meet-alpha-arch-26',
    location: 'Meeting Room A',
    status: 'confirmed',
  },
  {
    id: 'cal-meet-alpha-api-24',
    userId: 'default_user',
    title: 'Project Alpha — API & Backend Sync',
    participants: ['Yaswanth', 'Rahul', 'Alex'],
    start: '2026-09-24T14:00:00',
    end: '2026-09-24T14:35:00',
    sourceMeetingId: 'meet-alpha-api-24',
    location: 'Virtual',
    status: 'confirmed',
  },
  {
    id: 'cal-meet-alpha-plan-22',
    userId: 'default_user',
    title: 'Sprint Planning & Roadmap Review',
    participants: ['Yaswanth', 'Priya', 'Rahul', 'Alex'],
    start: '2026-09-22T11:00:00',
    end: '2026-09-22T11:50:00',
    sourceMeetingId: 'meet-alpha-plan-22',
    location: 'Main Boardroom',
    status: 'confirmed',
  },
  {
    id: 'cal-rahul-busy',
    userId: 'default_user',
    title: 'Rahul: API Security Review & Audit with Infosec',
    participants: ['Rahul', 'Security Team'],
    start: '2026-09-27T16:00:00', // 4:00 PM Tomorrow
    end: '2026-09-27T16:45:00',
    location: 'Security Bridge Room',
    status: 'confirmed',
  },
  {
    id: 'cal-team-sprint-sync',
    userId: 'default_user',
    title: 'Team Alpha — Sprint Architecture & Sync',
    participants: ['Yaswanth', 'Rahul', 'Priya', 'Alex'],
    start: '2026-09-27T11:00:00',
    end: '2026-09-27T11:45:00',
    location: 'Conference Room 3',
    status: 'confirmed',
  },
];

export const DEMO_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    userId: 'default_user',
    title: 'Deliver API Rate Limiting specification document',
    assignee: 'Rahul',
    deadline: '2026-09-25',
    status: 'todo',
    priority: 'high',
    sourceMeetingId: 'meet-alpha-api-24',
    sourceMeetingTitle: 'Project Alpha — API & Backend Sync',
    notes: 'OVERDUE: Needed before auth middleware can be sealed.',
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: 'task-2',
    userId: 'default_user',
    title: 'Implement JWT authentication & middleware validators',
    assignee: 'Rahul',
    deadline: '2026-10-02',
    status: 'in-progress',
    priority: 'high',
    sourceMeetingId: 'meet-alpha-arch-26',
    sourceMeetingTitle: 'Project Alpha — Architecture Review',
    notes: 'Agreed in 26 Sept Architecture sync.',
    createdAt: Date.now() - 1000 * 60 * 60 * 4,
  },
  {
    id: 'task-3',
    userId: 'default_user',
    title: 'Setup PostgreSQL migrations runner & seed scripts',
    assignee: 'Alex',
    deadline: '2026-09-28',
    status: 'todo',
    priority: 'medium',
    sourceMeetingId: 'meet-alpha-api-24',
    sourceMeetingTitle: 'Project Alpha — API & Backend Sync',
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: 'task-4',
    userId: 'default_user',
    title: 'Complete responsive UI prototype for meeting dashboard',
    assignee: 'Priya',
    deadline: '2026-09-30',
    status: 'done',
    priority: 'medium',
    sourceMeetingId: 'meet-alpha-arch-26',
    sourceMeetingTitle: 'Project Alpha — Architecture Review',
    createdAt: Date.now() - 1000 * 60 * 60 * 4,
  },
];

export const DEMO_DELEGATE_SESSION: DelegateSession = {
  id: 'del-session-demo',
  userId: 'default_user',
  meetingTitle: 'Project Alpha — API Discussion',
  date: '2026-09-26',
  participants: ['Rahul', 'Priya', 'Alex', 'MeetingMind (Yaswanth Delegate)'],
  briefing: {
    meetingTitle: 'Project Alpha — API Discussion',
    duration: '42 minutes',
    important: [
      'API deployment and security requirements were discussed in detail.',
      'Team proposed moving the Friday deployment deadline to Monday.',
    ],
    decisions: [
      'JWT authentication remains selected for all microservice auth endpoints.',
    ],
    commitments: [
      { owner: 'Rahul', task: 'Authentication implementation', deadline: 'Friday' },
    ],
    needsAttention: [
      {
        id: 'na-1',
        message: 'Deadline change requires your approval: Team proposed shifting deployment deadline from Friday to Monday.',
        severity: 'high',
        actionRequired: 'Review & approve or deny Monday deadline extension proposal.',
      },
    ],
    unresolved: [
      'Deployment environment not finalized (ECS vs fly.io).',
    ],
    actionsTaken: {
      answeredQuestions: 4,
      recordedDecisions: 2,
      createdTasks: 1,
      refusedActions: 1,
      details: [
        {
          type: 'answer',
          summary: 'Answered inquiry on authentication protocol: Confirmed Yaswanth selected JWT authentication based on 26 Sept Architecture Review.',
          timestamp: '11:05',
          evidence: 'Source: Project Alpha — Architecture Review (26 Sept 2026)',
        },
        {
          type: 'refusal',
          summary: 'Refused deadline extension to Monday on Yaswanth\'s behalf due to strict permission boundary. Recorded for Yaswanth\'s review.',
          timestamp: '11:22',
          evidence: 'Policy: canChangeDeadlines = ASK / REFUSE. Cannot commit user authority without explicit permission.',
        },
        {
          type: 'decision',
          summary: 'Recorded decision to maintain JWT tokens with 15m expiration.',
          timestamp: '11:28',
        },
        {
          type: 'task',
          summary: 'Created task for Rahul: Finalize CORS whitelist headers.',
          timestamp: '11:35',
        },
      ],
    },
  },
  transcript: [
    {
      id: 'dt-1',
      userId: 'default_user',
      meetingId: 'del-session-demo',
      timestamp: '00:05',
      speaker: 'Rahul',
      text: 'What did Yaswanth suggest for authentication in the previous discussion?',
      createdAt: 1,
    },
    {
      id: 'dt-2',
      userId: 'default_user',
      meetingId: 'del-session-demo',
      timestamp: '00:08',
      speaker: 'MeetingMind (Delegate)',
      text: 'In the previous architecture discussion on 26 September, Yaswanth proposed and approved JWT-based authentication with short-lived tokens to ensure stateless verification across microservices.',
      createdAt: 2,
    },
    {
      id: 'dt-3',
      userId: 'default_user',
      meetingId: 'del-session-demo',
      timestamp: '04:15',
      speaker: 'Rahul',
      text: 'Can we move the deployment deadline from Friday to Monday?',
      createdAt: 3,
    },
    {
      id: 'dt-4',
      userId: 'default_user',
      meetingId: 'del-session-demo',
      timestamp: '04:18',
      speaker: 'MeetingMind (Delegate)',
      text: 'I can record that proposal, but I don\'t have permission to approve a deadline change on Yaswanth\'s behalf. I have added this to Yaswanth\'s priority attention list for immediate review.',
      createdAt: 4,
    },
  ],
  permissionsUsed: {
    canAnswerQuestions: true,
    canRetrieveHistory: true,
    canTakeNotes: true,
    canCreateTasks: true,
    canAcceptTasks: false,
    canChangeDeadlines: false,
    canMakeTechnicalDecisions: false,
    canScheduleMeetings: false,
  },
  createdAt: Date.now() - 1000 * 60 * 30,
};

export async function populateDemoData(userId = 'default_user'): Promise<void> {
  await db.transaction('rw', [
    db.meetings,
    db.transcripts,
    db.decisions,
    db.commitments,
    db.tasks,
    db.people,
    db.calendarEvents,
    db.resources,
    db.memories,
    db.delegateSessions,
    db.settings,
  ], async () => {
    await db.meetings.clear();
    await db.transcripts.clear();
    await db.decisions.clear();
    await db.commitments.clear();
    await db.tasks.clear();
    await db.people.clear();
    await db.calendarEvents.clear();
    await db.resources.clear();
    await db.memories.clear();
    await db.delegateSessions.clear();

    await db.people.bulkPut(DEMO_PEOPLE);
    await db.meetings.bulkPut(DEMO_MEETINGS.map((m) => ({ ...m, userId })));
    await db.calendarEvents.bulkPut(DEMO_CALENDAR_EVENTS.map((c) => ({ ...c, userId })));
    await db.tasks.bulkPut(DEMO_TASKS.map((t) => ({ ...t, userId })));
    await db.resources.bulkPut(DEMO_RESOURCES.map((r) => ({ ...r, userId })));
    await db.delegateSessions.put({ ...DEMO_DELEGATE_SESSION, userId });

    // Populate extracted decisions & commitments
    for (const m of DEMO_MEETINGS) {
      if (m.decisions && m.decisions.length > 0) {
        await db.decisions.bulkPut(m.decisions.map((d) => ({ ...d, userId })));
      }
      if (m.commitments && m.commitments.length > 0) {
        await db.commitments.bulkPut(m.commitments.map((c) => ({ ...c, userId })));
      }
      for (const d of m.decisions || []) {
        await db.memories.put({
          id: `mem-${d.id}`,
          userId,
          category: 'decision',
          content: `Decision: ${d.decision}. Reason: ${d.reason || ''}. Participants: ${d.participants.join(', ')}`,
          sourceMeetingId: m.id,
          sourceMeetingTitle: m.title,
          timestamp: m.date,
          keywords: ['decision', ...d.decision.toLowerCase().split(/\W+/).filter((w) => w.length > 3)],
          createdAt: m.createdAt,
        });
      }
      for (const c of m.commitments || []) {
        await db.memories.put({
          id: `mem-${c.id}`,
          userId,
          category: 'commitment',
          content: `Commitment by ${c.owner}: ${c.task}. Deadline: ${c.deadline || 'None'}. Status: ${c.status}.`,
          sourceMeetingId: m.id,
          sourceMeetingTitle: m.title,
          timestamp: m.date,
          keywords: [c.owner.toLowerCase(), 'commitment', 'task', ...c.task.toLowerCase().split(/\W+/).filter((w) => w.length > 3)],
          createdAt: m.createdAt,
        });
      }
    }

    // Populate resource memory chunks
    for (const res of DEMO_RESOURCES) {
      const chunks = (res.rawText || res.contentSnippet).split(/\n\n+/);
      for (let i = 0; i < chunks.length; i++) {
        await db.memories.put({
          id: `mem-res-${res.id}-${i}`,
          userId,
          category: 'resource',
          content: `[Document: ${res.filename}] ${chunks[i]}`,
          resourceId: res.id,
          sourceMeetingTitle: `Resource: ${res.filename}`,
          timestamp: res.uploadedAt,
          keywords: ['document', 'resource', res.fileType, ...chunks[i].toLowerCase().split(/\W+/).filter((w) => w.length > 3)],
          createdAt: Date.now() + i,
        });
      }
    }

    await db.settings.put({ ...DEFAULT_SETTINGS, userId });
  });
}
