import { db } from '../db';
import { AgentToolRegistry } from '../agent/tools';
import { formatLocalDate } from '../utils/dateUtils';
import { queryOllama, OLLAMA_GENERATION_MODEL } from './llm';
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
  permissions: DelegatePermissions,
  userId = ''
): Promise<{
  response: string;
  actionTaken: 'answer' | 'decision' | 'task' | 'refusal' | 'note';
  evidenceSnippet?: string;
  needsAttentionItem?: { message: string; actionRequired: string };
}> {
  const queryLower = inputQuery.toLowerCase();

  // 1. Check for Deadline change proposal
  if (
    queryLower.includes('deadline') ||
    queryLower.includes('delay') ||
    queryLower.includes('postpone') ||
    queryLower.includes('extension') ||
    queryLower.includes('move milestone')
  ) {
    if (!permissions.canChangeDeadlines) {
      return {
        response: `I can note that proposal, but I am not authorized to approve deadline modifications on your behalf. I have logged this for your review.`,
        actionTaken: 'refusal',
        evidenceSnippet: 'Policy: canChangeDeadlines = ASK/REFUSE. Explicit user approval required.',
        needsAttentionItem: {
          message: `Deadline change proposed by ${speaker}: "${inputQuery}"`,
          actionRequired: 'Approve or reject the proposed deadline modification.',
        },
      };
    }
  }

  // 2. Check for Major Architectural / Database change proposal
  if (
    queryLower.includes('switch database') ||
    queryLower.includes('change database') ||
    queryLower.includes('mongodb') ||
    queryLower.includes('mysql') ||
    queryLower.includes('architectural change')
  ) {
    if (!permissions.canMakeTechnicalDecisions) {
      return {
        response: `I do not have authorization to approve technical or architectural decisions. I have recorded this inquiry for engineering review.`,
        actionTaken: 'refusal',
        evidenceSnippet: 'Policy: canMakeTechnicalDecisions = DENY.',
        needsAttentionItem: {
          message: `Technical decision proposal by ${speaker}: "${inputQuery}"`,
          actionRequired: 'Review and decide on architectural change.',
        },
      };
    }
  }

  // 3. Check for Factual inquiry regarding previous decisions / history
  if (
    queryLower.includes('what was decided') ||
    queryLower.includes('did we agree') ||
    queryLower.includes('previous discussion') ||
    queryLower.includes('suggest') ||
    queryLower.includes('decision')
  ) {
    if (permissions.canRetrieveHistory || permissions.canAnswerQuestions) {
      if (userId) {
        const decisions = await AgentToolRegistry.getDecisions(userId, inputQuery);
        if (decisions.length > 0) {
          const top = decisions[0];
          return {
            response: `Based on recorded decision from ${top.sourceMeetingTitle || 'prior discussion'}: "${top.decision}"${top.reason ? ` (Reason: ${top.reason})` : ''}.`,
            actionTaken: 'answer',
            evidenceSnippet: `Source: ${top.sourceMeetingTitle || 'Meeting Records'}`,
          };
        }
        const meetings = await AgentToolRegistry.searchMeetings(userId, inputQuery);
        if (meetings.length > 0 && meetings[0].summary) {
          return {
            response: `According to ${meetings[0].title}: ${meetings[0].summary}`,
            actionTaken: 'answer',
            evidenceSnippet: `Source: ${meetings[0].title}`,
          };
        }
      }
      return {
        response: `I searched your MeetingMind history, but found no prior recorded decisions on "${inputQuery}".`,
        actionTaken: 'answer',
      };
    } else {
      return {
        response: `I cannot retrieve historical records because the permission 'Retrieve History' is disabled.`,
        actionTaken: 'refusal',
        evidenceSnippet: 'Policy: canRetrieveHistory = DENY.',
      };
    }
  }

  // 4. Check for task assignment / commitment
  if (
    queryLower.includes('task') ||
    queryLower.includes('action item') ||
    queryLower.includes('will do') ||
    queryLower.includes('commit to') ||
    queryLower.includes('deliver')
  ) {
    if (permissions.canCreateTasks) {
      return {
        response: `Understood. I have recorded that task for team tracking and added it to the post-meeting action log.`,
        actionTaken: 'task',
        evidenceSnippet: `Action item recorded from ${speaker}'s update.`,
      };
    }
  }

  // 5. General search in history if query is asking something
  if (queryLower.includes('?') && permissions.canAnswerQuestions && userId) {
    const meetings = await AgentToolRegistry.searchMeetings(userId, inputQuery);
    if (meetings.length > 0 && meetings[0].summary) {
      return {
        response: `From ${meetings[0].title}: ${meetings[0].summary}`,
        actionTaken: 'answer',
        evidenceSnippet: `Source: ${meetings[0].title}`,
      };
    }
  }

  // Default neutral listening / acknowledgement
  return {
    response: `Noted. I have recorded this in the meeting notes.`,
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
  const decisionsCount = actions.filter((a) => a.type === 'decision').length;
  const tasksCount = actions.filter((a) => a.type === 'task').length;
  const refusedCount = actions.filter((a) => a.type === 'refusal').length;

  let important: string[] = [];
  let decisions: string[] = [];
  let commitments: Array<{ owner: string; task: string; deadline?: string }> = [];
  let unresolved: string[] = [];

  // Try generating briefing via Ollama if transcript exists
  if (transcript.length > 1) {
    try {
      const transcriptText = transcript.map((t) => `${t.speaker}: ${t.text}`).join('\n');
      const prompt = `You are an AI Delegate that attended a meeting titled "${meetingTitle}".
Analyze this meeting transcript and summarize the key results into valid JSON only.
Format:
{
  "important": ["key point 1", "key point 2"],
  "decisions": ["decision 1"],
  "commitments": [{"owner": "Person", "task": "Task description", "deadline": "Date or Friday"}],
  "unresolved": ["pending topic"]
}

Transcript:
${transcriptText}

JSON response only:`;

      const response = await queryOllama(prompt, { model: OLLAMA_GENERATION_MODEL, jsonFormat: true });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.important)) important = parsed.important;
        if (Array.isArray(parsed.decisions)) decisions = parsed.decisions;
        if (Array.isArray(parsed.commitments)) commitments = parsed.commitments;
        if (Array.isArray(parsed.unresolved)) unresolved = parsed.unresolved;
      }
    } catch {
      // Fall through to deterministic extraction
    }
  }

  // Graceful fallback from real actions and transcript
  if (important.length === 0) {
    important = [
      `Meeting discussion focused on ${meetingTitle}.`,
      `${transcript.length} turns recorded during the session.`,
    ];
  }
  if (decisions.length === 0 && decisionsCount > 0) {
    decisions = actions.filter((a) => a.type === 'decision').map((a) => a.summary);
  }
  if (commitments.length === 0 && tasksCount > 0) {
    commitments = actions
      .filter((a) => a.type === 'task')
      .map((a) => ({ owner: 'Team', task: a.summary, deadline: 'Upcoming' }));
  }

  const briefing: DelegateBriefing = {
    meetingTitle,
    duration: `${durationMinutes} minutes`,
    important,
    decisions,
    commitments,
    needsAttention: needsAttention.map((na, idx) => ({
      id: `na-${Date.now()}-${idx}`,
      message: na.message,
      severity: 'high',
      actionRequired: na.actionRequired,
    })),
    unresolved,
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
    date: formatLocalDate(new Date()),
    participants: [...participants, 'MeetingMind (Delegate)'],
    briefing,
    transcript,
    permissionsUsed: permissions,
    createdAt: Date.now(),
  };

  await db.delegateSessions.put(session);
  return session;
}
