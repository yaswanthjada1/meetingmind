import { db } from '../db';
import { MeetingAnalysis, Decision, Commitment, TaskItem, ImportantPoint, Question, Deadline, Conflict } from '../types';

// Centralized Ollama Model Configuration
export const OLLAMA_BASE_URL = 'http://localhost:11434';
export const OLLAMA_GENERATION_MODEL = 'qwen3:8b';
export const OLLAMA_FAST_MODEL = 'qwen3:1.7b';
export const OLLAMA_EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
export const OLLAMA_FALLBACK_EMBEDDING_MODEL = 'nomic-embed-text:latest';

export interface LLMRequestOptions {
  systemPrompt?: string;
  temperature?: number;
  jsonFormat?: boolean;
  model?: string;
}

export interface OllamaHealthStatus {
  ok: boolean;
  models: string[];
  hasGenerationModel: boolean;
  hasEmbeddingModel: boolean;
  error?: string;
}

/**
 * Checks if local Ollama instance is reachable and returns installed models.
 */
export async function checkOllamaHealth(endpoint = OLLAMA_BASE_URL): Promise<OllamaHealthStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${endpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        ok: false,
        models: [],
        hasGenerationModel: false,
        hasEmbeddingModel: false,
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name || m.model || '');
    const hasGenerationModel = models.some((m) => m.includes('qwen3:8b') || m.includes('qwen3:1.7b'));
    const hasEmbeddingModel = models.some((m) => m.includes('qwen3-embedding:0.6b') || m.includes('nomic-embed-text'));

    return {
      ok: true,
      models,
      hasGenerationModel,
      hasEmbeddingModel,
    };
  } catch (err: any) {
    return {
      ok: false,
      models: [],
      hasGenerationModel: false,
      hasEmbeddingModel: false,
      error: err?.message || 'Offline',
    };
  }
}

/**
 * Generates vector embeddings for a given text chunk using qwen3-embedding:0.6b.
 */
export async function generateEmbedding(
  text: string,
  model = OLLAMA_EMBEDDING_MODEL,
  endpoint = OLLAMA_BASE_URL
): Promise<number[]> {
  if (!text || !text.trim()) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${endpoint}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text.substring(0, 2000), // Max context chunk
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.embedding) && data.embedding.length > 0) {
        return data.embedding;
      }
    }
  } catch (err) {
    // Graceful fallback to term-frequency vector
  }

  // Fallback term-frequency vector representation
  return generateDeterministicVector(text);
}

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Fallback deterministic word-frequency vector generator for offline mode.
 */
function generateDeterministicVector(text: string, dimensions = 64): number[] {
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  const vec = new Array(dimensions).fill(0);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1;
  }

  // Normalize
  const mag = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0));
  return mag > 0 ? vec.map((v) => v / mag) : vec;
}

/**
 * Sends a generation request to Ollama using qwen3:8b or qwen3:1.7b.
 */
export async function queryOllama(
  prompt: string,
  options: LLMRequestOptions = {}
): Promise<string> {
  const endpoint = OLLAMA_BASE_URL;
  const model = options.model || OLLAMA_GENERATION_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000); // 35s timeout for 8b

  try {
    const body: any = {
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.1,
      },
    };

    if (options.systemPrompt) {
      body.system = options.systemPrompt;
    }

    if (options.jsonFormat) {
      body.format = 'json';
    }

    const res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.response;
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Intelligent meeting transcript analysis using qwen3:8b.
 * Evaluates real transcript + referenced RAG resources to produce structured meeting intelligence.
 */
export async function analyzeMeetingContent(
  meetingTitle: string,
  rawText: string,
  participants: string[],
  resourceContext?: string
): Promise<MeetingAnalysis> {
  const prompt = `You are MeetingMind's AI Meeting Analyst.
Analyze the following meeting transcript for "${meetingTitle}".

Participants: ${participants.join(', ')}

${resourceContext ? `Related Reference Documents (RAG Context):\n${resourceContext}\n` : ''}

Meeting Transcript:
${rawText}

Extract and return a JSON object with this EXACT structure (valid JSON only, no markdown):
{
  "summary": "Concise 2-3 sentence overview of what occurred during the meeting.",
  "importantPoints": [
    { "id": "ip-1", "point": "Key technical or product discussion point", "category": "Architecture/Timeline/Product" }
  ],
  "decisions": [
    {
      "id": "dec-1",
      "decision": "Explicit decision agreed upon",
      "reason": "Why this decision was made",
      "alternatives": ["Alternative considered if any"],
      "participants": ["${participants[0] || 'Team'}"],
      "status": "active"
    }
  ],
  "commitments": [
    {
      "id": "com-1",
      "owner": "Person name who promised the task",
      "task": "Specific task promised",
      "deadline": "Deadline or date mentioned",
      "status": "pending",
      "confidence": 0.95
    }
  ],
  "questions": [
    { "id": "q-1", "question": "Question asked", "askedBy": "Name", "answered": true, "answer": "Answer provided" }
  ],
  "deadlines": [
    { "id": "dl-1", "task": "Task description", "owner": "Name", "date": "Date" }
  ],
  "unresolvedQuestions": ["Unanswered open question 1"],
  "conflicts": []
}`;

  try {
    const rawResponse = await queryOllama(prompt, {
      systemPrompt: 'You are an accurate AI meeting analyst. Always output strictly valid JSON without markdown formatting or backticks.',
      jsonFormat: true,
      temperature: 0.1,
      model: OLLAMA_GENERATION_MODEL,
    });

    const cleanJson = rawResponse.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed && typeof parsed.summary === 'string') {
      return {
        summary: parsed.summary,
        importantPoints: Array.isArray(parsed.importantPoints) ? parsed.importantPoints : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : [],
        conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
        unresolvedQuestions: Array.isArray(parsed.unresolvedQuestions) ? parsed.unresolvedQuestions : [],
      };
    }
  } catch (err) {
    console.warn('Ollama qwen3:8b generation unavailable or invalid JSON, parsing transcript via rule extractor:', err);
  }

  // Real rule-based transcript parsing fallback
  return extractStructuredContentFromText(meetingTitle, rawText, participants);
}

/**
 * Extracts real structured items from transcript text when LLM is offline.
 */
function extractStructuredContentFromText(
  meetingTitle: string,
  rawText: string,
  participants: string[]
): MeetingAnalysis {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const importantPoints: ImportantPoint[] = [];
  const decisions: Decision[] = [];
  const commitments: Commitment[] = [];
  const questions: Question[] = [];
  const deadlines: Deadline[] = [];
  const unresolvedQuestions: string[] = [];

  let summary = `Meeting session for "${meetingTitle}" with ${participants.length > 0 ? participants.join(', ') : 'team members'}.`;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Decisions
    if (lower.includes('decide') || lower.includes('agreed') || lower.includes('decision:')) {
      const cleanDec = line.replace(/^[-\d•*.)\s]+/, '').replace(/decision:\s*/i, '').trim();
      decisions.push({
        id: `dec-${Date.now()}-${decisions.length}`,
        decision: cleanDec,
        reason: `Agreed during ${meetingTitle}`,
        participants: participants.length > 0 ? participants : ['Team'],
        sourceMeetingId: '',
        date: new Date().toISOString().split('T')[0],
        status: 'active',
      });
    }

    // Commitments / Tasks: e.g. "Rahul -> Implement auth -> Friday" or "will do X"
    if (line.includes('→') || line.includes('->') || lower.includes('will ') || lower.includes('action item:')) {
      const parts = line.split(/[→\->:]/).map((s) => s.trim());
      const owner = parts[0].replace(/^[-•*]\s*/, '').trim() || participants[0] || 'Team';
      const task = parts[1] || parts[0];
      const deadline = parts[2] || 'Upcoming';

      commitments.push({
        id: `com-${Date.now()}-${commitments.length}`,
        owner,
        task,
        deadline,
        sourceMeetingId: '',
        status: 'pending',
        confidence: 0.9,
      });

      deadlines.push({
        id: `dl-${Date.now()}-${deadlines.length}`,
        task,
        owner,
        date: deadline,
      });
    }

    // Questions / Unresolved
    if (line.includes('?') || lower.includes('unresolved') || lower.includes('question:')) {
      const cleanQ = line.replace(/^[-\d•*.)\s]+/, '').trim();
      questions.push({
        id: `q-${Date.now()}-${questions.length}`,
        question: cleanQ,
        answered: false,
      });
      unresolvedQuestions.push(cleanQ);
    }

    // Bullet points / Key points
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      const pt = line.replace(/^[-•*]\s*/, '').trim();
      if (pt.length > 10) {
        importantPoints.push({
          id: `ip-${Date.now()}-${importantPoints.length}`,
          point: pt,
          category: 'Discussion',
        });
      }
    }
  }

  return {
    summary,
    importantPoints: importantPoints.slice(0, 8),
    decisions: decisions.slice(0, 5),
    commitments: commitments.slice(0, 8),
    questions: questions.slice(0, 5),
    deadlines: deadlines.slice(0, 5),
    conflicts: [],
    unresolvedQuestions: unresolvedQuestions.slice(0, 5),
  };
}
