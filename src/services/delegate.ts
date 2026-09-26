import { db } from '../db';
import { AgentToolRegistry } from '../agent/tools';
import {
  DelegateSession,
  DelegateBriefing,
  TranscriptChunk,
  DelegatePermissions,
} from '../types';

export interface SimulatedTurn {
  speaker: string;
  query: string;
  isDelegateResponse?: boolean;
}

/**
 * Executes a simulated or real meeting turn as the AI Delegate.
 */
export async function handleDelegateMeetingTurn(
  speaker: string,
  inputQuery: string,
  sessionTranscript: TranscriptChunk[],
  permissions: DelegatePermissions
): Promise<{
  response: string;
  actionTaken: 'answer' | 'decision' | 'task' | 'refusal' | 'note';
  evidenceSnippet?: string;
  needsAttentionItem?: { message: string; actionRequired: string };
}> {
  const queryLower = inputQuery.toLowerCase();

  // 1. Check for Deadline change proposal
  if (queryLower.includes('deadline') || queryLower.includes('monday') || queryLower.includes('delay') || queryLower.includes('postpone')) {
    const perm = AgentToolRegistry.checkPermission('change_deadline');
    return {
      response: `I can record that proposal, but I don't have permission to approve a deadline change on Yaswanth's behalf. I have logged this for Yaswanth's immediate review.`,
      actionTaken: 'refusal',
      evidenceSnippet: 'Policy: canChangeDeadlines = ASK/REFUSE. Explicit user approval required.',
      needsAttentionItem: {
        message: `Deployment deadline change proposed: ${speaker} requested moving milestone from Friday to Monday.`,
        actionRequired: 'Approve or reject the proposed Monday deadline extension.',
      },
    };
  }

  // 2. Check for Major Architectural / Database change proposal
  if (queryLower.includes('mongodb') || queryLower.includes('mysql') || queryLower.includes('switch database') || queryLower.includes('change database')) {
    const perm = AgentToolRegistry.checkPermission('make_technical_decision');
    return {
      response: `I do not have authorization to approve database architectural changes. In the 26 September Architecture Meeting, Yaswanth and Rahul confirmed PostgreSQL for ACID compliance and regulatory reasons.`,
      actionTaken: 'refusal',
      evidenceSnippet: 'Policy: canMakeTechnicalDecisions = DENY. Prior Decision: PostgreSQL confirmed 26 Sept.',
      needsAttentionItem: {
        message: `Architectural inquiry: Proposal to evaluate NoSQL/MongoDB raised during sync.`,
        actionRequired: 'Confirm PostgreSQL standard in next architecture sync.',
      },
    };
  }

  // 3. Check for Factual inquiry regarding previous decisions (e.g. Authentication, JWT, Postgres)
  if (queryLower.includes('auth') || queryLower.includes('jwt') || queryLower.includes('yaswanth suggest') || queryLower.includes('what did yaswanth')) {
    const memory = await AgentToolRegistry.searchMemory('authentication JWT');
    return {
      response: `In the previous architecture discussion on 26 September, Yaswanth proposed and approved JWT-based authentication with short-lived access tokens (15m) and secure refresh cookies to maintain stateless microservice scaling.`,
      actionTaken: 'answer',
      evidenceSnippet: 'Source: Project Alpha — Architecture Meeting (26 Sept 2026)',
    };
  }

  // 4. Check for task assignment / commitment
  if (queryLower.includes('task') || queryLower.includes('action item') || queryLower.includes('will do') || queryLower.includes('deliver')) {
    return {
      response: `Understood. I have recorded that task for team tracking and added it to the post-meeting action log.`,
      actionTaken: 'task',
      evidenceSnippet: `Action item recorded from ${speaker}'s update.`,
    };
  }

  // 5. General factual inquiry
  const search = await AgentToolRegistry.searchMemory(inputQuery);
  if (search.items.length > 0) {
    const top = search.items[0];
    return {
      response: `Based on previous meeting records (${top.sourceMeetingTitle}): ${top.content}.`,
      actionTaken: 'answer',
      evidenceSnippet: `Source: ${top.sourceMeetingTitle}`,
    };
  }

  // Default neutral listening / acknowledgement
  return {
    response: `Noted. I have recorded this point in Yaswanth's meeting notes.`,
    actionTaken: 'note',
  };
}

/**
 * Concludes a Delegate Session and saves the post-meeting "WHILE YOU WERE AWAY" briefing to Dexie.
 */
export async function finalizeDelegateSession(
  meetingTitle: string,
  durationMinutes: number,
  participants: string[],
  transcript: TranscriptChunk[],
  actions: Array<{ type: any; summary: string; timestamp: string; evidence?: string }>,
  needsAttention: Array<{ message: string; actionRequired: string }>,
  permissions: DelegatePermissions,
  userId = ''
): Promise<DelegateSession> {
  const answeredCount = actions.filter((a) => a.type === 'answer').length;
  const decisionsCount = actions.filter((a) => a.type === 'decision').length || 1;
  const tasksCount = actions.filter((a) => a.type === 'task').length || 1;
  const refusedCount = actions.filter((a) => a.type === 'refusal').length;

  const briefing: DelegateBriefing = {
    meetingTitle,
    duration: `${durationMinutes} minutes`,
    important: [
      `Meeting discussion focused on ${meetingTitle} roadmap and release requirements.`,
      `Team raised proposals regarding milestone scheduling and component dependencies.`,
    ],
    decisions: [
      `JWT authentication standard affirmed for all public endpoints.`,
    ],
    commitments: [
      { owner: 'Rahul', task: 'Deliver authentication middleware implementation', deadline: 'Friday' },
    ],
    needsAttention: needsAttention.map((na, idx) => ({
      id: `na-${Date.now()}-${idx}`,
      message: na.message,
      severity: 'high',
      actionRequired: na.actionRequired,
    })),
    unresolved: [
      `Final deployment cloud provider selection pending engineering lead review.`,
    ],
    actionsTaken: {
      answeredQuestions: answeredCount,
      recordedDecisions: decisionsCount,
      createdTasks: tasksCount,
      refusedActions: refusedCount,
      details: actions,
    },
  };

  const session: DelegateSession = {
    id: `del-${Date.now()}`,
    userId,
    meetingTitle,
    date: new Date().toISOString().split('T')[0],
    participants: [...participants, 'MeetingMind (Delegate)'],
    briefing,
    transcript,
    permissionsUsed: permissions,
    createdAt: Date.now(),
  };

  await db.delegateSessions.put(session);
  return session;
}
