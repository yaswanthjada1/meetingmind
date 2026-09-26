import { AgentToolRegistry } from './tools';
import { db } from '../db';
import { AgentResponse, AgentEvidence, Meeting, ResourceDocument, TaskItem, Decision, Commitment } from '../types';

export class CoordinatorAgent {
  /**
   * Central coordinator agent following the local-first loop:
   * Understand Intent → Select Local Tool(s) → Retrieve Records → Reason over Context → Cite Sources
   */
  async process(userQuery: string): Promise<AgentResponse> {
    const q = userQuery.trim().toLowerCase();

    // 1. Upcoming / Schedule Briefing Intent
    if (
      q.includes('what should i know before') ||
      q.includes('prepare for my next meeting') ||
      q.includes('next meeting') ||
      q.includes('before tomorrow') ||
      q.includes('what meetings do i have') ||
      q.includes('my schedule') ||
      q.includes('today\'s meeting')
    ) {
      return await this.handleMeetingPreparationAndSchedule(userQuery);
    }

    // 2. Recent Meeting History ("What happened yesterday?", "What happened in my last meeting?")
    if (
      q.includes('what happened') ||
      q.includes('last meeting') ||
      q.includes('yesterday') ||
      q.includes('this week') ||
      q.includes('recent meeting') ||
      q.includes('summary of')
    ) {
      return await this.handleRecentMeetingsSummary(userQuery);
    }

    // 3. Commitments & Tasks Intent
    if (
      q.includes('task') ||
      q.includes('unfinished') ||
      q.includes('overdue') ||
      q.includes('promise') ||
      q.includes('commit') ||
      q.includes('action item') ||
      q.includes('supposed to do') ||
      q.includes('assigned to')
    ) {
      return await this.handleCommitmentsAndTasks(userQuery);
    }

    // 4. Unresolved questions & open items
    if (q.includes('unresolved') || q.includes('open question') || q.includes('pending question')) {
      return await this.handleUnresolvedItems(userQuery);
    }

    // 5. While away / Delegate session report
    if (
      q.includes('while i was away') ||
      q.includes('delegate briefing') ||
      q.includes('delegate report') ||
      q.includes('missed meeting')
    ) {
      return await this.handleWhileAway(userQuery);
    }

    // 6. Resources & Knowledge base search
    if (q.includes('document') || q.includes('architecture.pdf') || q.includes('resource') || q.includes('guidelines') || q.includes('api spec')) {
      return await this.handleResourceRetrieval(userQuery);
    }

    // Default: Multi-Source Memory & Decisions Search (Reasoning over Meetings + Resources + Decisions)
    return await this.handleGeneralMemorySearch(userQuery);
  }

  /**
   * Prepares briefings for upcoming meetings with connected background context.
   */
  private async handleMeetingPreparationAndSchedule(query: string): Promise<AgentResponse> {
    const upcomingMeetings = await AgentToolRegistry.getUpcomingMeetings();
    const pastMeetings = await AgentToolRegistry.getPastMeetings();
    const tasks = await AgentToolRegistry.getTasks();
    const resources = await AgentToolRegistry.searchResources();

    let message = '';
    const retrievedSources: Array<{ id: string; title: string; snippet: string }> = [];

    if (upcomingMeetings.length === 0) {
      message = `You currently have **no upcoming meetings** registered in your schedule.\n\n` +
        `You can add existing Google Meet, Zoom, or Teams sessions from the Calendar page.`;
    } else {
      const nextM = upcomingMeetings[0];
      message = `📅 **Next Scheduled Meeting:** **${nextM.title}**\n` +
        `• **When:** ${nextM.date} at ${nextM.startTime || '10:00 AM'} (${nextM.durationMinutes} mins)\n` +
        `• **Platform:** ${nextM.platform ? nextM.platform.replace('_', ' ').toUpperCase() : 'External'}\n` +
        `• **Participants:** ${nextM.participants.join(', ')}\n\n`;

      retrievedSources.push({
        id: nextM.id,
        title: nextM.title,
        snippet: `Scheduled for ${nextM.date} at ${nextM.startTime}`,
      });

      // Find relevant past context
      const relevantPast = pastMeetings.filter(
        (p) =>
          p.title.toLowerCase().includes(nextM.title.toLowerCase()) ||
          p.participants.some((person) => nextM.participants.includes(person))
      );

      if (relevantPast.length > 0) {
        message += `💡 **Key Context from Previous Syncs:**\n`;
        for (const prev of relevantPast.slice(0, 2)) {
          message += `• In *${prev.title}* (${prev.date}): ${prev.summary || 'Prior decisions and action items established.'}\n`;
          retrievedSources.push({
            id: prev.id,
            title: prev.title,
            snippet: prev.summary,
          });
        }
        message += `\n`;
      }

      // Check pending tasks for these participants
      const relevantTasks = tasks.filter((t) =>
        nextM.participants.some((p) => p.toLowerCase() === t.assignee.toLowerCase()) && t.status !== 'done'
      );

      if (relevantTasks.length > 0) {
        message += `⏳ **Pending Action Items to Follow Up On:**\n`;
        for (const t of relevantTasks) {
          message += `• **${t.assignee}** → ${t.title} (${t.deadline ? `Due ${t.deadline}` : 'Pending'})\n`;
          retrievedSources.push({
            id: t.id,
            title: t.sourceMeetingTitle || 'Task',
            snippet: `${t.assignee}: ${t.title}`,
          });
        }
      }
    }

    const evidence: AgentEvidence = {
      inputs: { query },
      retrievedSources,
      constraints: ['Local IndexedDB schedule inspection', 'Zero cloud telemetry'],
      selectedAction: 'getUpcomingMeetings & synthesizeBriefing',
      rationale: `Retrieved ${upcomingMeetings.length} upcoming meetings and correlated with past commitments.`,
      timestamp: Date.now(),
    };

    return {
      message,
      evidence,
      actionTaken: 'getUpcomingMeetings',
      suggestedFollowUps: ['Show me all overdue tasks', 'What happened in the last architecture sync?'],
    };
  }

  /**
   * Summarizes recent completed meetings.
   */
  private async handleRecentMeetingsSummary(query: string): Promise<AgentResponse> {
    const pastMeetings = await AgentToolRegistry.getPastMeetings();
    const retrievedSources: Array<{ id: string; title: string; snippet: string }> = [];

    if (pastMeetings.length === 0) {
      return {
        message: `You don't have any processed meeting recordings in local memory yet.\n\n` +
          `Once you record or upload a meeting session, MeetingMind will generate full summaries, decisions, and action items.`,
        evidence: {
          inputs: { query },
          retrievedSources: [],
          constraints: ['Local IndexedDB query'],
          selectedAction: 'getPastMeetings',
          rationale: 'No processed meetings in database.',
          timestamp: Date.now(),
        },
      };
    }

    const latest = pastMeetings[0];
    let message = `Here is the intelligence summary from your most recent meeting:\n\n` +
      `📌 **${latest.title}** (${latest.date})\n` +
      `**Platform:** ${latest.platform ? latest.platform.replace('_', ' ').toUpperCase() : 'External'} • **Participants:** ${latest.participants.join(', ')}\n\n` +
      `**Summary:**\n${latest.summary || 'Discussion concluded with action items.'}\n\n`;

    retrievedSources.push({
      id: latest.id,
      title: latest.title,
      snippet: latest.summary || latest.title,
    });

    if (latest.decisions && latest.decisions.length > 0) {
      message += `✅ **Key Decisions:**\n` +
        latest.decisions.map((d) => `• ${d.decision} (*${d.reason || 'Agreed'}*)`).join('\n') + `\n\n`;
    }

    if (latest.commitments && latest.commitments.length > 0) {
      message += `📋 **Commitments Made:**\n` +
        latest.commitments.map((c) => `• **${c.owner}** → ${c.task} (${c.deadline || 'Upcoming'})`).join('\n') + `\n\n`;
    }

    const evidence: AgentEvidence = {
      inputs: { query },
      retrievedSources,
      constraints: ['IndexedDB local storage'],
      selectedAction: 'getPastMeetings',
      rationale: `Retrieved latest meeting ${latest.title} on ${latest.date}.`,
      timestamp: Date.now(),
    };

    return {
      message,
      evidence,
      actionTaken: 'getPastMeetings',
      suggestedFollowUps: ['What tasks are still pending?', 'What should I know before my next meeting?'],
    };
  }

  /**
   * Handles commitments and task status queries.
   */
  private async handleCommitmentsAndTasks(query: string): Promise<AgentResponse> {
    const q = query.toLowerCase();
    let targetOwner: string | undefined;
    if (q.includes('rahul')) targetOwner = 'Rahul';
    else if (q.includes('priya')) targetOwner = 'Priya';
    else if (q.includes('alex')) targetOwner = 'Alex';

    const [commitments, tasks] = await Promise.all([
      AgentToolRegistry.getCommitments(targetOwner),
      AgentToolRegistry.getTasks(targetOwner),
    ]);

    const overdueCommitments = commitments.filter((c) => c.status === 'overdue');
    const pendingTasks = tasks.filter((t) => t.status !== 'done');
    const completedTasks = tasks.filter((t) => t.status === 'done');

    let message = '';
    const retrievedSources: Array<{ id: string; title: string; snippet: string }> = [];

    if (overdueCommitments.length > 0 || pendingTasks.length > 0) {
      message = `Here is the current status of commitments and tasks in local memory:\n\n`;

      if (overdueCommitments.length > 0) {
        message += `🔴 **Overdue Action Items (${overdueCommitments.length})**:\n`;
        for (const c of overdueCommitments) {
          message += `• **${c.owner}** → ${c.task} (Deadline: ${c.deadline || 'Past due'})\n  *Source: [${c.sourceMeetingTitle || 'Meeting'}]*\n`;
          retrievedSources.push({
            id: c.id,
            title: c.sourceMeetingTitle || 'Meeting',
            snippet: `Overdue commitment: ${c.owner} -> ${c.task} due ${c.deadline}`,
          });
        }
        message += `\n`;
      }

      if (pendingTasks.length > 0) {
        message += `⏳ **Pending Tasks (${pendingTasks.length})**:\n`;
        for (const t of pendingTasks) {
          message += `• **${t.assignee}** → ${t.title} (${t.deadline ? `Due: ${t.deadline}` : 'Pending'})\n  *Source: [${t.sourceMeetingTitle || 'Meeting'}]*\n`;
          retrievedSources.push({
            id: t.id,
            title: t.sourceMeetingTitle || 'Task',
            snippet: `${t.assignee}: ${t.title} (${t.status})`,
          });
        }
      }
    } else if (completedTasks.length > 0) {
      message = `All recorded tasks are completed:\n` +
        completedTasks.map((t) => `• ✅ **${t.assignee}** → ${t.title}`).join('\n');
    } else {
      message = `No active or overdue tasks found in local memory.`;
    }

    const evidence: AgentEvidence = {
      inputs: { query, targetOwner: targetOwner || 'All' },
      retrievedSources,
      constraints: ['IndexedDB local store only'],
      selectedAction: 'getCommitments & getTasks',
      rationale: `Retrieved ${tasks.length} total tasks.`,
      timestamp: Date.now(),
    };

    return {
      message,
      evidence,
      actionTaken: 'getTasks',
      suggestedFollowUps: ['What happened in my last meeting?', 'What should I know before tomorrow?'],
    };
  }

  /**
   * Handles unresolved questions queries.
   */
  private async handleUnresolvedItems(query: string): Promise<AgentResponse> {
    const unresolved = await AgentToolRegistry.getUnresolvedItems();
    const retrievedSources: Array<{ id: string; title: string; snippet: string }> = [];

    if (unresolved.length === 0) {
      return {
        message: `There are currently **no unresolved questions** recorded across your meetings. All tracked questions have been answered.`,
        evidence: {
          inputs: { query },
          retrievedSources: [],
          constraints: ['Local IndexedDB query'],
          selectedAction: 'getUnresolvedItems',
          rationale: 'No open items in database.',
          timestamp: Date.now(),
        },
      };
    }

    let message = `Here are the unresolved questions requiring follow-up:\n\n`;
    for (const item of unresolved) {
      message += `• ❓ **${item.question}**\n  *Raised in: [${item.meetingTitle}]*\n`;
      retrievedSources.push({
        id: 'unresolved-item',
        title: item.meetingTitle,
        snippet: item.question,
      });
    }

    const evidence: AgentEvidence = {
      inputs: { query },
      retrievedSources,
      constraints: ['IndexedDB local store only'],
      selectedAction: 'getUnresolvedItems',
      rationale: `Found ${unresolved.length} unresolved questions across meetings.`,
      timestamp: Date.now(),
    };

    return {
      message,
      evidence,
      actionTaken: 'getUnresolvedItems',
      suggestedFollowUps: ['What tasks are pending?', 'What happened in the last meeting?'],
    };
  }

  /**
   * Handles "While I was away" briefing queries.
   */
  private async handleWhileAway(query: string): Promise<AgentResponse> {
    const session = await db.delegateSessions.toCollection().last();
    const retrievedSources: Array<{ id: string; title: string; snippet: string }> = [];

    if (session) {
      const b = session.briefing;
      const message = `**WHILE YOU WERE AWAY**\n\n` +
        `**Meeting:** ${b.meetingTitle} (${b.duration})\n\n` +
        `**Summary & Important:**\n` +
        b.important.map((i) => `• ${i}`).join('\n') + `\n\n` +
        `**Decisions Recorded:**\n` +
        b.decisions.map((d) => `• ${d}`).join('\n') + `\n\n` +
        `🔴 **Needs Your Attention:**\n` +
        b.needsAttention.map((na) => `• ${na.message} (*${na.actionRequired}*)`).join('\n') + `\n\n` +
        `**AI Delegate Actions:**\n` +
        `• Answered ${b.actionsTaken.answeredQuestions} factual questions from memory\n` +
        `• Recorded ${b.actionsTaken.recordedDecisions} decisions\n` +
        `• Created ${b.actionsTaken.createdTasks} task\n` +
        `• Refused ${b.actionsTaken.refusedActions} unauthorized action`;

      retrievedSources.push({
        id: session.id,
        title: session.meetingTitle,
        snippet: `Delegate briefing attended with ${session.participants.join(', ')}`,
      });

      return {
        message,
        evidence: {
          inputs: { query },
          retrievedSources,
          constraints: ['Deterministic delegate permission checks enforced'],
          selectedAction: 'getDelegateReport',
          rationale: 'Retrieved latest AI Delegate briefing session.',
          timestamp: Date.now(),
        },
        actionTaken: 'getDelegateReport',
        suggestedFollowUps: ['Review pending deadline extension', 'Show overdue tasks'],
      };
    }

    return {
      message: `No recent delegate sessions recorded while you were away.`,
      evidence: {
        inputs: { query },
        retrievedSources: [],
        constraints: ['IndexedDB local search'],
        selectedAction: 'getDelegateReport',
        rationale: 'No delegate sessions found.',
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Handles questions about uploaded documents and RAG resources.
   */
  private async handleResourceRetrieval(query: string): Promise<AgentResponse> {
    const resources = await AgentToolRegistry.searchResources(query);
    const retrievedSources: Array<{ id: string; title: string; snippet: string }> = [];

    if (resources.length > 0) {
      const top = resources[0];
      const message = `📄 **Resource Matched:** **${top.filename}** (${top.title})\n\n` +
        `**Content Summary:**\n${top.contentSnippet}\n\n` +
        (top.rawText ? `**Excerpt:**\n${top.rawText.substring(0, 300)}...` : '');

      retrievedSources.push({
        id: top.id,
        title: top.filename,
        snippet: top.contentSnippet,
      });

      return {
        message,
        evidence: {
          inputs: { query },
          retrievedSources,
          constraints: ['Local RAG resource search'],
          selectedAction: 'searchResources',
          rationale: `Matched document ${top.filename} in local store.`,
          timestamp: Date.now(),
        },
        actionTaken: 'searchResources',
      };
    }

    return await this.handleGeneralMemorySearch(query);
  }

  /**
   * General multi-source search across memory, decisions, and transcripts with clear citations.
   */
  private async handleGeneralMemorySearch(query: string): Promise<AgentResponse> {
    const memoryResult = await AgentToolRegistry.searchMemory(query);
    const items = memoryResult.items;

    let message = '';
    const retrievedSources: Array<{ id: string; title: string; snippet: string }> = [];

    if (items.length > 0) {
      const top = items[0];
      const otherSources = items.slice(1, 3);

      message = `Based on retrieved meeting records in local memory:\n\n` +
        `• **${top.content}**\n\n` +
        `📄 **Source:** *${top.sourceMeetingTitle} (${top.date || 'Previous Session'})*`;

      if (otherSources.length > 0) {
        message += `\n\n**Additional Context:**\n` +
          otherSources.map((s) => `• ${s.content} *(Source: ${s.sourceMeetingTitle})*`).join('\n');
      }

      for (const item of items) {
        retrievedSources.push({
          id: item.id,
          title: item.sourceMeetingTitle,
          snippet: item.content,
        });
      }
    } else {
      message = `I searched your local meeting memory and documents for "${query}", but no directly matching notes, decisions, or commitments were found.`;
    }

    const evidence: AgentEvidence = {
      inputs: { query },
      retrievedSources,
      constraints: ['Local IndexedDB TF-IDF vector retrieval', 'Zero server data leakage'],
      selectedAction: 'searchMemory',
      rationale: `Found ${items.length} relevant memory records.`,
      timestamp: Date.now(),
    };

    return {
      message,
      evidence,
      actionTaken: 'searchMemory',
      suggestedFollowUps: ['What tasks do I have?', 'What happened in my last meeting?'],
    };
  }
}

export const coordinator = new CoordinatorAgent();
