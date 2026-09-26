import { db } from '../db';
import { MemoryEntry, Decision, Commitment, Meeting, ResourceDocument } from '../types';

export interface RetrievedMemoryItem {
  id: string;
  sourceMeetingId?: string;
  resourceId?: string;
  sourceMeetingTitle: string;
  category: string;
  content: string;
  date: string;
  score: number;
  itemType?: 'meeting' | 'resource';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function calculateSimilarity(queryTokens: string[], docTokens: string[]): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  let matches = 0;

  for (const token of docTokens) {
    if (querySet.has(token)) {
      matches += 1;
    }
  }

  const queryStr = queryTokens.join(' ');
  const docStr = docTokens.join(' ');
  let bonus = 0;
  if (docStr.includes(queryStr)) {
    bonus = 0.5;
  }

  const baseScore = matches / Math.sqrt(queryTokens.length * docTokens.length);
  return Math.min(1.0, baseScore + bonus);
}

/**
 * Searches local IndexedDB memories (meetings + uploaded RAG resources).
 */
export async function searchLocalMemory(query: string, limit = 6): Promise<RetrievedMemoryItem[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const [allMemories, allDecisions, allCommitments, allMeetings, allResources] = await Promise.all([
    db.memories.toArray(),
    db.decisions.toArray(),
    db.commitments.toArray(),
    db.meetings.toArray(),
    db.resources.toArray(),
  ]);

  const results: RetrievedMemoryItem[] = [];

  // 1. Search in memories table (includes indexed resource chunks)
  for (const mem of allMemories) {
    const docTokens = tokenize(`${mem.content} ${mem.keywords.join(' ')} ${mem.sourceMeetingTitle}`);
    const score = calculateSimilarity(queryTokens, docTokens);
    if (score > 0.05) {
      results.push({
        id: mem.id,
        sourceMeetingId: mem.sourceMeetingId,
        resourceId: mem.resourceId,
        sourceMeetingTitle: mem.sourceMeetingTitle,
        category: mem.category,
        content: mem.content,
        date: mem.timestamp,
        score: mem.category === 'resource' ? score * 1.1 : score,
        itemType: mem.category === 'resource' ? 'resource' : 'meeting',
      });
    }
  }

  // 2. Search in decisions table
  for (const dec of allDecisions) {
    const text = `Decision: ${dec.decision}. Reason: ${dec.reason || ''}. Alternatives: ${(dec.alternatives || []).join(', ')}. Participants: ${dec.participants.join(', ')}`;
    const docTokens = tokenize(`${text} ${dec.sourceMeetingTitle || ''}`);
    const score = calculateSimilarity(queryTokens, docTokens);
    if (score > 0.08) {
      results.push({
        id: dec.id,
        sourceMeetingId: dec.sourceMeetingId,
        sourceMeetingTitle: dec.sourceMeetingTitle || 'Meeting',
        category: 'decision',
        content: text,
        date: dec.date,
        score: score * 1.25,
        itemType: 'meeting',
      });
    }
  }

  // 3. Search in commitments table
  for (const com of allCommitments) {
    const text = `Commitment by ${com.owner}: ${com.task}. Deadline: ${com.deadline || 'None'}. Status: ${com.status}`;
    const docTokens = tokenize(`${text} ${com.sourceMeetingTitle || ''}`);
    const score = calculateSimilarity(queryTokens, docTokens);
    if (score > 0.08) {
      results.push({
        id: com.id,
        sourceMeetingId: com.sourceMeetingId,
        sourceMeetingTitle: com.sourceMeetingTitle || 'Meeting',
        category: 'commitment',
        content: text,
        date: com.deadline || '',
        score: score * 1.15,
        itemType: 'meeting',
      });
    }
  }

  // 4. Search in full uploaded resources
  for (const res of allResources) {
    const text = `${res.title} ${res.filename} ${res.rawText || res.contentSnippet}`;
    const docTokens = tokenize(text);
    const score = calculateSimilarity(queryTokens, docTokens);
    if (score > 0.08) {
      results.push({
        id: res.id,
        resourceId: res.id,
        sourceMeetingTitle: `Resource: ${res.filename}`,
        category: 'resource',
        content: res.contentSnippet,
        date: res.uploadedAt,
        score: score * 1.2,
        itemType: 'resource',
      });
    }
  }

  // Sort by score descending and deduplicate
  const seen = new Set<string>();
  const uniqueResults: RetrievedMemoryItem[] = [];

  results.sort((a, b) => b.score - a.score);

  for (const item of results) {
    const key = `${item.sourceMeetingId || item.resourceId}-${item.content.substring(0, 40)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(item);
      if (uniqueResults.length >= limit) break;
    }
  }

  return uniqueResults;
}

export async function indexMeetingMemories(meeting: Meeting): Promise<void> {
  const entries: MemoryEntry[] = [];

  if (meeting.summary) {
    entries.push({
      id: `mem-sum-${meeting.id}`,
      userId: meeting.userId || 'default_user',
      category: 'summary',
      content: `Meeting Summary: ${meeting.summary}`,
      sourceMeetingId: meeting.id,
      sourceMeetingTitle: meeting.title,
      timestamp: meeting.date,
      keywords: tokenize(meeting.summary),
      createdAt: Date.now(),
    });
  }

  for (const d of meeting.decisions || []) {
    entries.push({
      id: `mem-${d.id}`,
      userId: meeting.userId || 'default_user',
      category: 'decision',
      content: `Decision: ${d.decision}. Reason: ${d.reason || ''}. Participants: ${d.participants.join(', ')}`,
      sourceMeetingId: meeting.id,
      sourceMeetingTitle: meeting.title,
      timestamp: meeting.date,
      keywords: ['decision', ...tokenize(d.decision)],
      createdAt: Date.now(),
    });
  }

  for (const c of meeting.commitments || []) {
    entries.push({
      id: `mem-${c.id}`,
      userId: meeting.userId || 'default_user',
      category: 'commitment',
      content: `Commitment by ${c.owner}: ${c.task}. Deadline: ${c.deadline || 'None'}. Status: ${c.status}`,
      sourceMeetingId: meeting.id,
      sourceMeetingTitle: meeting.title,
      timestamp: meeting.date,
      keywords: [c.owner.toLowerCase(), 'commitment', 'task', ...tokenize(c.task)],
      createdAt: Date.now(),
    });
  }

  for (const p of meeting.importantPoints || []) {
    entries.push({
      id: `mem-${p.id}`,
      userId: meeting.userId || 'default_user',
      category: 'fact',
      content: `Important Point: ${p.point}`,
      sourceMeetingId: meeting.id,
      sourceMeetingTitle: meeting.title,
      timestamp: meeting.date,
      keywords: ['point', ...tokenize(p.point)],
      createdAt: Date.now(),
    });
  }

  if (entries.length > 0) {
    await db.memories.bulkPut(entries);
  }
}
