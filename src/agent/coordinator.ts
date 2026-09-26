import { AgentToolRegistry } from './tools';
import { queryOllama, OLLAMA_GENERATION_MODEL } from '../services/llm';
import { AgentResponse, AgentEvidence } from '../types';

export class CoordinatorAgent {
  /**
   * Central coordinator agent following authentic local reasoning:
   * 1. Retrieve user-scoped records from IndexedDB using tools.
   * 2. If no matching records exist, return fallback without hallucinating.
   * 3. Send retrieved evidence to qwen3:8b for grounded synthesis.
   * 4. Expose exact citations and evidence metadata.
   */
  async process(userQuery: string, userId = 'default_user'): Promise<AgentResponse> {
    const q = userQuery.trim();
    if (!q) {
      return {
        message: 'Please ask a question about your meetings, tasks, or resources.',
      };
    }

    if (!userId) {
      return {
        message: 'Please sign in to view your MeetingMind records.',
      };
    }

    const lower = q.toLowerCase();
    const retrievedSources: Array<{ id: string; title: string; snippet: string; type?: 'meeting' | 'resource' }> = [];
    let contextBuffer = '';

    // 1. Tool execution based on query context
    const isScheduleQuery =
      lower.includes('today') ||
      lower.includes('schedule') ||
      lower.includes('upcoming') ||
      lower.includes('next meeting') ||
      lower.includes('what do i have');

    const isTaskQuery =
      lower.includes('task') ||
      lower.includes('commitment') ||
      lower.includes('deadline') ||
      lower.includes('action item') ||
      lower.includes('pending') ||
      lower.includes('overdue');

    const isDecisionQuery =
      lower.includes('decide') ||
      lower.includes('decision') ||
      lower.includes('agreed') ||
      lower.includes('what did we');

    // Retrieve Meetings
    if (isScheduleQuery) {
      const todaysMeetings = await AgentToolRegistry.getTodaysMeetings(userId);
      const upcoming = await AgentToolRegistry.getUpcomingMeetings(userId);

      if (todaysMeetings.length > 0) {
        contextBuffer += `Meetings Today:\n`;
        todaysMeetings.forEach((m) => {
          contextBuffer += `• "${m.title}" at ${m.startTime || '10:00'} (${m.durationMinutes} min, Platform: ${m.platform || 'External'}). Participants: ${m.participants.join(', ')}. Summary: ${m.summary || 'Scheduled'}\n`;
          retrievedSources.push({
            id: m.id,
            title: `${m.title} (${m.date})`,
            snippet: m.summary || `Scheduled at ${m.startTime}`,
            type: 'meeting',
          });
        });
      }

      if (upcoming.length > 0) {
        contextBuffer += `Upcoming Meetings:\n`;
        upcoming.slice(0, 3).forEach((m) => {
          contextBuffer += `• "${m.title}" on ${m.date} at ${m.startTime || '10:00'}. Participants: ${m.participants.join(', ')}\n`;
          retrievedSources.push({
            id: m.id,
            title: `${m.title} (${m.date})`,
            snippet: `Upcoming on ${m.date}`,
            type: 'meeting',
          });
        });
      }
    } else {
      // General search over meetings
      const matchedMeetings = await AgentToolRegistry.searchMeetings(userId, q);
      if (matchedMeetings.length > 0) {
        contextBuffer += `Relevant Meetings:\n`;
        matchedMeetings.slice(0, 3).forEach((m) => {
          contextBuffer += `• Meeting "${m.title}" (${m.date}): ${m.summary || m.rawNotes || 'No notes'}\n`;
          if (m.decisions && m.decisions.length > 0) {
            contextBuffer += `  Decisions: ${m.decisions.map((d) => d.decision).join('; ')}\n`;
          }
          if (m.commitments && m.commitments.length > 0) {
            contextBuffer += `  Commitments: ${m.commitments.map((c) => `${c.owner}: ${c.task}`).join('; ')}\n`;
          }
          retrievedSources.push({
            id: m.id,
            title: `${m.title} (${m.date})`,
            snippet: m.summary || m.title,
            type: 'meeting',
          });
        });
      }
    }

    // Retrieve Decisions
    if (isDecisionQuery || !isScheduleQuery) {
      const decisions = await AgentToolRegistry.getDecisions(userId, q);
      if (decisions.length > 0) {
        contextBuffer += `Recorded Decisions:\n`;
        decisions.slice(0, 4).forEach((d) => {
          contextBuffer += `• ${d.decision} (Reason: ${d.reason || 'Agreed'}, Source: ${d.sourceMeetingTitle || 'Meeting'})\n`;
          retrievedSources.push({
            id: d.id,
            title: d.sourceMeetingTitle || 'Decision',
            snippet: d.decision,
            type: 'meeting',
          });
        });
      }
    }

    // Retrieve Tasks / Commitments
    if (isTaskQuery) {
      const tasks = await AgentToolRegistry.searchTasks(userId, q);
      const commitments = await AgentToolRegistry.getCommitments(userId);

      if (tasks.length > 0) {
        contextBuffer += `Tasks:\n`;
        tasks.slice(0, 5).forEach((t) => {
          contextBuffer += `• ${t.title} [Status: ${t.status}] (Assignee: ${t.assignee || 'Unassigned'}, Due: ${t.deadline || 'None'}, Source: ${t.sourceMeetingTitle || 'Task'})\n`;
          retrievedSources.push({
            id: t.id,
            title: t.sourceMeetingTitle || 'Task Tracker',
            snippet: `${t.title} (${t.assignee})`,
            type: 'meeting',
          });
        });
      }

      if (commitments.length > 0 && tasks.length === 0) {
        contextBuffer += `Commitments:\n`;
        commitments.slice(0, 5).forEach((c) => {
          contextBuffer += `• ${c.owner} promised: ${c.task} (Deadline: ${c.deadline || 'Upcoming'}, Source: ${c.sourceMeetingTitle || 'Meeting'})\n`;
          retrievedSources.push({
            id: c.id,
            title: c.sourceMeetingTitle || 'Commitment',
            snippet: `${c.owner}: ${c.task}`,
            type: 'meeting',
          });
        });
      }
    }

    // Retrieve RAG Resources Chunks via qwen3-embedding:0.6b
    try {
      const resourceChunks = await AgentToolRegistry.searchResourceChunks(userId, q, 3);
      if (resourceChunks.length > 0) {
        contextBuffer += `Uploaded Resource Documents:\n`;
        resourceChunks.forEach((rc) => {
          contextBuffer += `• [Document: ${rc.filename} - ${rc.heading || 'Section'}]\n${rc.chunk.text}\n\n`;
          retrievedSources.push({
            id: rc.chunk.id,
            title: `${rc.filename} (${rc.heading || 'Section'})`,
            snippet: rc.snippet,
            type: 'resource',
          });
        });
      }
    } catch (ragErr) {
      console.warn('RAG retrieval warning:', ragErr);
    }

    // STRICT GROUNDING: If contextBuffer is completely empty, do NOT hallucinate!
    if (!contextBuffer.trim()) {
      return {
        message: "I couldn't find enough information in your MeetingMind data.",
        evidence: {
          inputs: { userQuery },
          retrievedSources: [],
          constraints: ['Strict data grounding', 'Zero hallucination policy'],
          selectedAction: 'searchLocalRecords',
          rationale: 'No matching meeting, task, or document records found in local IndexedDB for this user.',
          timestamp: Date.now(),
        },
      };
    }

    // Reason over real context using qwen3:8b
    const systemPrompt = `You are MeetingMind's AI Assistant.
Answer the user's question accurately, concisely, and directly using ONLY the context provided below.
Rules:
1. Do NOT invent facts or assume information outside the provided context.
2. Return the direct answer immediately without long internal chain-of-thought explanations.
3. If the provided context does not contain enough information to answer the question, output ONLY: "I couldn't find enough information in your MeetingMind data."
4. At the end of your response, cite the exact source(s) used, for example: Source: Weekly Sync Meeting (15 Oct 2026) or Source: Architecture.pdf`;

    const prompt = `Context from user's local MeetingMind records:
${contextBuffer}

User Question: ${q}

Answer:`;

    try {
      const responseText = await queryOllama(prompt, {
        systemPrompt,
        temperature: 0.1,
        model: OLLAMA_GENERATION_MODEL,
        timeoutMs: 30000,
      });

      const evidence: AgentEvidence = {
        inputs: { userQuery },
        retrievedSources,
        constraints: ['Local IndexedDB user-scoped query', 'qwen3:8b local inference'],
        selectedAction: 'reasonOverEvidence',
        rationale: `Retrieved ${retrievedSources.length} records from local database and reasoned via ${OLLAMA_GENERATION_MODEL}.`,
        timestamp: Date.now(),
      };

      return {
        message: responseText.trim(),
        evidence,
        actionTaken: 'queryOllama',
      };
    } catch (llmErr: any) {
      // If Ollama is offline, return the retrieved factual records directly
      return {
        message: `Local AI (qwen3:8b) is currently unreachable. Here are your matching local records:\n\n${contextBuffer}`,
        evidence: {
          inputs: { userQuery },
          retrievedSources,
          constraints: ['Local data extraction', 'Ollama offline fallback'],
          selectedAction: 'returnDirectContext',
          rationale: 'Retrieved records directly from IndexedDB without model inference.',
          timestamp: Date.now(),
        },
      };
    }
  }
}

export const coordinator = new CoordinatorAgent();
