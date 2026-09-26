import { MeetingAnalysis } from '../types';

// Centralized Ollama Model Configuration — EXACT INSTALLED MODELS ONLY
export const OLLAMA_BASE_URL = typeof window !== 'undefined' ? '/ollama' : 'http://localhost:11434';
export const OLLAMA_GENERATION_MODEL = 'qwen3:8b';
export const OLLAMA_FAST_MODEL = 'qwen3:1.7b';
export const OLLAMA_EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
export const OLLAMA_FALLBACK_EMBEDDING_MODEL = 'nomic-embed-text:latest';
export const OLLAMA_CODER_MODEL = 'qwen2.5-coder:1.5b';

export interface LLMRequestOptions {
  systemPrompt?: string;
  temperature?: number;
  jsonFormat?: boolean;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface OllamaHealthStatus {
  ok: boolean;
  models: string[];
  hasPrimaryReasoning: boolean; // qwen3:8b
  hasFastModel: boolean;        // qwen3:1.7b
  hasEmbeddingModel: boolean;   // qwen3-embedding:0.6b
  hasFallbackEmbedding: boolean;// nomic-embed-text:latest
  hasCoderModel: boolean;       // qwen2.5-coder:1.5b
  missingRequired: string[];
  isFullyReady: boolean;
  error?: string;
}

export interface StructuredOllamaResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  model: string;
  durationMs: number;
  status: 'success' | 'failed' | 'timeout' | 'cancelled';
}

/**
 * Serial Inference Queue for heavy Ollama models (qwen3:8b).
 * Ensures local inference is never overloaded by concurrent generation requests.
 */
class OllamaQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const nextTask = this.queue.shift();
    if (nextTask) {
      try {
        await nextTask();
      } catch (e) {
        // Task error handled inside caller promise
      }
    }
    this.processing = false;
    this.processNext();
  }
}

export const ollamaQueue = new OllamaQueue();

/**
 * Universal request wrapper with AbortController timeout.
 * Guaranteed to resolve with a structured result without hanging forever.
 */
export async function requestWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 15000,
  modelName = 'Ollama',
  externalSignal?: AbortSignal
): Promise<StructuredOllamaResult<T>> {
  const startedAt = Date.now();
  const controller = new AbortController();

  let isTimedOut = false;
  const timeoutId = setTimeout(() => {
    isTimedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  try {
    const result = await fn(controller.signal);
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
    return {
      success: true,
      data: result,
      model: modelName,
      durationMs: Date.now() - startedAt,
      status: 'success',
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
    const durationMs = Date.now() - startedAt;

    if (isTimedOut || (err?.name === 'AbortError' && isTimedOut)) {
      return {
        success: false,
        error: 'OLLAMA_TIMEOUT',
        model: modelName,
        durationMs,
        status: 'timeout',
      };
    }

    if (externalSignal?.aborted || err?.name === 'AbortError') {
      return {
        success: false,
        error: 'OLLAMA_CANCELLED',
        model: modelName,
        durationMs,
        status: 'cancelled',
      };
    }

    return {
      success: false,
      error: err?.message || 'Ollama request failed',
      model: modelName,
      durationMs,
      status: 'failed',
    };
  }
}

/**
 * Fast & lightweight health check of Ollama tags.
 * Takes ~50ms, never triggers model load or inference.
 */
export async function checkOllamaHealth(endpoint = OLLAMA_BASE_URL): Promise<OllamaHealthStatus> {
  const res = await requestWithTimeout(async (signal) => {
    const r = await fetch(`${endpoint}/api/tags`, { signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }, 4000, 'Ollama Tags');

  if (!res.success || !res.data) {
    return {
      ok: false,
      models: [],
      hasPrimaryReasoning: false,
      hasFastModel: false,
      hasEmbeddingModel: false,
      hasFallbackEmbedding: false,
      hasCoderModel: false,
      missingRequired: ['qwen3:8b', 'qwen3:1.7b', 'qwen3-embedding:0.6b'],
      isFullyReady: false,
      error: res.error || 'Ollama service offline',
    };
  }

  const models: string[] = (res.data.models || []).map((m: any) => m.name || m.model || '');
  const hasPrimaryReasoning = models.some((m) => m === 'qwen3:8b' || m.startsWith('qwen3:8b'));
  const hasFastModel = models.some((m) => m === 'qwen3:1.7b' || m.startsWith('qwen3:1.7b'));
  const hasEmbeddingModel = models.some((m) => m === 'qwen3-embedding:0.6b' || m.startsWith('qwen3-embedding:0.6b'));
  const hasFallbackEmbedding = models.some((m) => m === 'nomic-embed-text:latest' || m.startsWith('nomic-embed-text'));
  const hasCoderModel = models.some((m) => m === 'qwen2.5-coder:1.5b' || m.startsWith('qwen2.5-coder'));

  const missingRequired: string[] = [];
  if (!hasPrimaryReasoning) missingRequired.push('qwen3:8b');
  if (!hasFastModel) missingRequired.push('qwen3:1.7b');
  if (!hasEmbeddingModel) missingRequired.push('qwen3-embedding:0.6b');

  const isFullyReady = hasPrimaryReasoning && hasFastModel && (hasEmbeddingModel || hasFallbackEmbedding);

  return {
    ok: true,
    models,
    hasPrimaryReasoning,
    hasFastModel,
    hasEmbeddingModel,
    hasFallbackEmbedding,
    hasCoderModel,
    missingRequired,
    isFullyReady,
  };
}

/**
 * Generates vector embeddings for a given text chunk.
 * Uses qwen3-embedding:0.6b strictly, falling back to nomic-embed-text:latest
 * ONLY if qwen3-embedding:0.6b is unavailable.
 */
export async function generateEmbedding(
  text: string,
  model = OLLAMA_EMBEDDING_MODEL,
  endpoint = OLLAMA_BASE_URL,
  signal?: AbortSignal
): Promise<number[]> {
  if (!text || !text.trim()) return [];

  const performFetch = async (targetModel: string) => {
    const res = await requestWithTimeout(async (abortSignal) => {
      const r = await fetch(`${endpoint}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          prompt: text.substring(0, 3000),
        }),
        signal: abortSignal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }, 12000, targetModel, signal);

    if (res.success && Array.isArray(res.data?.embedding) && res.data.embedding.length > 0) {
      return res.data.embedding;
    }
    return null;
  };

  const primaryVector = await performFetch(model);
  if (primaryVector) return primaryVector;

  // Try fallback if primary model was qwen3-embedding:0.6b
  if (model === OLLAMA_EMBEDDING_MODEL) {
    const fallbackVector = await performFetch(OLLAMA_FALLBACK_EMBEDDING_MODEL);
    if (fallbackVector) return fallbackVector;
  }

  return [];
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
 * Sends a generation request to Ollama using qwen3:8b or qwen3:1.7b.
 * Queues qwen3:8b requests on OllamaQueue to avoid overloading local GPU/CPU inference.
 */
export async function queryOllama(
  prompt: string,
  options: LLMRequestOptions = {}
): Promise<string> {
  const model = options.model || OLLAMA_GENERATION_MODEL;
  // Safety Limits: 120s for 8B primary reasoning, 60s for 1.7B fast operations
  const timeoutMs = options.timeoutMs || (model === OLLAMA_GENERATION_MODEL ? 120000 : 60000);

  const executeCall = async () => {
    const res = await requestWithTimeout(
      async (signal) => {
        const body: any = {
          model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.1,
            num_predict: options.jsonFormat ? 3072 : 1024,
          },
        };

        if (options.systemPrompt) body.system = options.systemPrompt;
        if (options.jsonFormat) body.format = 'json';

        const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });

        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
        const data = await r.json();
        return data.response;
      },
      timeoutMs,
      model,
      options.signal
    );

    if (!res.success) {
      if (res.status === 'timeout') {
        throw new Error(`OLLAMA_TIMEOUT: Model ${model} did not respond within safety limit (${Math.round(res.durationMs / 1000)}s)`);
      }
      throw new Error(res.error || `Ollama generation failed (${model})`);
    }

    return res.data || '';
  };

  // Queue heavy 8B reasoning requests to prevent concurrent GPU/CPU overloading
  if (model === OLLAMA_GENERATION_MODEL) {
    return ollamaQueue.enqueue(executeCall);
  } else {
    return executeCall();
  }
}

/**
 * Intelligent meeting transcript analysis using qwen3:8b.
 * Evaluates real transcript + referenced RAG resources to produce structured meeting intelligence.
 * Throws explicit error if Ollama is unreachable or model produces invalid JSON.
 */
export async function analyzeMeetingContent(
  meetingTitle: string,
  rawText: string,
  participants: string[],
  resourceContext?: string
): Promise<MeetingAnalysis> {
  if (!rawText.trim()) {
    throw new Error('Cannot analyze empty transcript.');
  }

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
    { "id": "ip-1", "point": "Key technical or product discussion point", "category": "Discussion" }
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
      timeoutMs: 120000,
    });

    const cleanJson = rawResponse.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (!parsed || typeof parsed.summary !== 'string') {
      throw new Error('Missing "summary" string in model response');
    }

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
  } catch (err: any) {
    throw new Error(`Meeting analysis failed — model returned invalid structured output: ${err?.message || 'Parsing error'}`);
  }
}

