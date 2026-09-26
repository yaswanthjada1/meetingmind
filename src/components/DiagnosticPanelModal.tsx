import React, { useState, useEffect } from 'react';
import { checkOllamaHealth, requestWithTimeout, OLLAMA_BASE_URL } from '../services/llm';
import { db } from '../db';
import { recordingManager } from '../services/recordingService';
import { resourceIngestion } from '../services/resourceIngestion';
import { X, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Cpu, Database, Mic, Play, Volume2 } from 'lucide-react';
import { defaultTranscriptionProvider, STTProviderStatus } from '../services/transcriptionProvider';

interface DiagnosticPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

interface TestResult {
  status: 'idle' | 'testing' | 'passed' | 'failed' | 'timeout';
  durationMs?: number;
  error?: string;
}

export const DiagnosticPanelModal: React.FC<DiagnosticPanelModalProps> = ({ isOpen, onClose, userId = 'default_user' }) => {
  const [ollamaStatus, setOllamaStatus] = useState<any>(null);
  const [sttStatus, setSttStatus] = useState<STTProviderStatus | null>(null);

  const [fastTest, setFastTest] = useState<TestResult>({ status: 'idle' });
  const [primaryTest, setPrimaryTest] = useState<TestResult>({ status: 'idle' });
  const [embedTest, setEmbedTest] = useState<TestResult>({ status: 'idle' });
  const [isTestingModels, setIsTestingModels] = useState(false);

  const [dbResourcesCount, setDbResourcesCount] = useState(0);
  const [dbChunksCount, setDbChunksCount] = useState(0);
  const [chunksWithEmbeddingsCount, setChunksWithEmbeddingsCount] = useState(0);

  const [recSnapshot, setRecSnapshot] = useState(recordingManager.getSnapshot());

  /**
   * Fast diagnostic check — tags, STT capability, and storage metrics only.
   * Purges orphaned chunks to guarantee strict resource:chunk relationships.
   */
  const loadConnectivityAndStorage = async () => {
    // 1. Check Ollama tags via proxy
    const health = await checkOllamaHealth();
    setOllamaStatus(health);

    // 2. Check real STT capability status
    try {
      const stt = await defaultTranscriptionProvider.getStatus();
      setSttStatus(stt);
    } catch (e) {
      console.warn('Diagnostic STT error:', e);
    }

    // 3. Query IndexedDB metrics
    try {
      await resourceIngestion.purgeOrphanedChunks();

      const allResources = await db.resources.toArray();
      const allChunks = await db.resourceChunks.toArray();

      setDbResourcesCount(allResources.length);
      setDbChunksCount(allChunks.length);

      const withEmb = allChunks.filter((c) => Array.isArray(c.embedding) && c.embedding.length > 0);
      setChunksWithEmbeddingsCount(withEmb.length);
    } catch (e) {
      console.warn('Diagnostic DB error:', e);
    }
  };

  /**
   * Executes live model generation & embedding tests SEQUENTIALLY through OllamaQueue.
   * Prevents GPU/CPU memory contention and cold-load lockups.
   */
  const runLiveModelTests = async () => {
    setIsTestingModels(true);
    setFastTest({ status: 'testing' });
    setPrimaryTest({ status: 'idle' });
    setEmbedTest({ status: 'idle' });

    // 1. qwen3:1.7b Fast Generation Test (60s safety limit)
    const fastRes = await requestWithTimeout(
      async (signal) => {
        const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3:1.7b',
            prompt: 'Reply with OK',
            stream: false,
            options: { temperature: 0, num_predict: 5 },
          }),
          signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        return data.response;
      },
      60000,
      'qwen3:1.7b'
    );

    if (fastRes.success && (fastRes.data?.includes('OK') || (fastRes.data && fastRes.data.trim().length > 0))) {
      setFastTest({ status: 'passed', durationMs: fastRes.durationMs });
    } else if (fastRes.status === 'timeout') {
      setFastTest({ status: 'timeout', durationMs: fastRes.durationMs, error: 'OLLAMA_TIMEOUT (60s safety limit reached)' });
    } else {
      setFastTest({ status: 'failed', durationMs: fastRes.durationMs, error: fastRes.error });
    }

    // 2. qwen3:8b Primary Reasoning Generation Test (120s safety limit for cold load)
    setPrimaryTest({ status: 'testing' });
    const primaryRes = await requestWithTimeout(
      async (signal) => {
        const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3:8b',
            prompt: 'Reply with OK',
            stream: false,
            options: { temperature: 0, num_predict: 5 },
          }),
          signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        return data.response;
      },
      120000,
      'qwen3:8b'
    );

    if (primaryRes.success && (primaryRes.data?.includes('OK') || (primaryRes.data && primaryRes.data.trim().length > 0))) {
      setPrimaryTest({ status: 'passed', durationMs: primaryRes.durationMs });
    } else if (primaryRes.status === 'timeout') {
      setPrimaryTest({ status: 'timeout', durationMs: primaryRes.durationMs, error: 'OLLAMA_TIMEOUT (120s safety limit reached)' });
    } else {
      setPrimaryTest({ status: 'failed', durationMs: primaryRes.durationMs, error: primaryRes.error });
    }

    // 3. qwen3-embedding:0.6b Embed Vector Test (60s safety limit)
    setEmbedTest({ status: 'testing' });
    const embedRes = await requestWithTimeout(
      async (signal) => {
        const r = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3-embedding:0.6b',
            prompt: 'Diagnostic test text',
          }),
          signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
          throw new Error('Empty embedding vector returned');
        }
        return data.embedding;
      },
      60000,
      'qwen3-embedding:0.6b'
    );

    if (embedRes.success) {
      setEmbedTest({ status: 'passed', durationMs: embedRes.durationMs });
    } else if (embedRes.status === 'timeout') {
      setEmbedTest({ status: 'timeout', durationMs: embedRes.durationMs, error: 'OLLAMA_TIMEOUT (60s safety limit reached)' });
    } else {
      setEmbedTest({ status: 'failed', durationMs: embedRes.durationMs, error: embedRes.error });
    }

    setIsTestingModels(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadConnectivityAndStorage();
    }
    const unsub = recordingManager.subscribe((snap) => {
      setRecSnapshot(snap);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const renderTestStatus = (test: TestResult) => {
    const formatSec = (ms?: number) => (ms ? `${(ms / 1000).toFixed(1)}s` : '');

    switch (test.status) {
      case 'testing':
        return <span className="text-zinc-400 animate-pulse font-medium">Testing...</span>;
      case 'passed':
        return (
          <span className="text-emerald-700 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> PASSED — {formatSec(test.durationMs)}
          </span>
        );
      case 'timeout':
        return (
          <div className="flex flex-col">
            <span className="text-amber-700 flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> TIMEOUT — {formatSec(test.durationMs)}
            </span>
            <span className="text-[10px] text-amber-800/80 font-mono mt-0.5">{test.error || 'OLLAMA_TIMEOUT'}</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex flex-col">
            <span className="text-rose-700 flex items-center gap-1 font-semibold">
              <XCircle className="w-3.5 h-3.5 text-rose-600" /> FAILED — {formatSec(test.durationMs)}
            </span>
            <span className="text-[10px] text-rose-800/80 font-mono mt-0.5">{test.error || 'Request error'}</span>
          </div>
        );
      default:
        return <span className="text-zinc-400 font-normal">Not tested</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-2xl max-w-xl w-full p-6 relative max-h-[90vh] overflow-y-auto text-xs text-zinc-700">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-zinc-900" />
            <h3 className="font-semibold text-sm text-zinc-900">MeetingMind Runtime Diagnostics</h3>
          </div>
          <button
            onClick={loadConnectivityAndStorage}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md border border-zinc-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Connectivity</span>
          </button>
        </div>

        {/* 1. Ollama Connectivity */}
        <section className="mb-5 space-y-2">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
            <span>1. Ollama Connectivity & Model Availability (/ollama)</span>
          </h4>

          <div className="p-3 rounded-md bg-zinc-50 border border-zinc-200 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span>Ollama Server:</span>
              <span className={`font-semibold ${ollamaStatus?.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {ollamaStatus?.ok ? '● CONNECTED' : '○ DISCONNECTED'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>qwen3:8b (Primary Reasoning):</span>
              <span className={`font-semibold ${ollamaStatus?.hasPrimaryReasoning ? 'text-emerald-700' : 'text-rose-700'}`}>
                {ollamaStatus?.hasPrimaryReasoning ? '✓ AVAILABLE' : '✗ MISSING'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>qwen3:1.7b (Fast Local Ops):</span>
              <span className={`font-semibold ${ollamaStatus?.hasFastModel ? 'text-emerald-700' : 'text-rose-700'}`}>
                {ollamaStatus?.hasFastModel ? '✓ AVAILABLE' : '✗ MISSING'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>qwen3-embedding:0.6b (RAG Vectors):</span>
              <span className={`font-semibold ${ollamaStatus?.hasEmbeddingModel ? 'text-emerald-700' : 'text-rose-700'}`}>
                {ollamaStatus?.hasEmbeddingModel ? '✓ AVAILABLE' : '✗ MISSING'}
              </span>
            </div>
          </div>
        </section>

        {/* 2. Model Test Execution */}
        <section className="mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">
              2. Live Model Test Executions (On Demand)
            </h4>
            <button
              onClick={runLiveModelTests}
              disabled={isTestingModels || !ollamaStatus?.ok}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white rounded-md transition-colors"
            >
              <Play className={`w-3 h-3 ${isTestingModels ? 'animate-spin' : ''}`} />
              <span>{isTestingModels ? 'Testing Models...' : 'Run Live Model Tests'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div className="p-2.5 rounded-md bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-500 mb-1 text-[11px]">qwen3:1.7b Fast Gen</div>
              <div className="font-semibold text-xs">{renderTestStatus(fastTest)}</div>
            </div>

            <div className="p-2.5 rounded-md bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-500 mb-1 text-[11px]">qwen3:8b Generation</div>
              <div className="font-semibold text-xs">{renderTestStatus(primaryTest)}</div>
            </div>

            <div className="p-2.5 rounded-md bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-500 mb-1 text-[11px]">qwen3-embedding</div>
              <div className="font-semibold text-xs">{renderTestStatus(embedTest)}</div>
            </div>
          </div>
        </section>

        {/* 3. IndexedDB & RAG Storage Metrics */}
        <section className="mb-5 space-y-2">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-zinc-500" />
            <span>3. IndexedDB & Vector Storage Metrics</span>
          </h4>

          <div className="p-3 rounded-md bg-zinc-50 border border-zinc-200 grid grid-cols-3 gap-2 font-mono text-xs text-center">
            <div>
              <div className="text-zinc-500 text-[10px]">Resources</div>
              <div className="text-base font-bold text-zinc-900">{dbResourcesCount}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-[10px]">Text Chunks</div>
              <div className="text-base font-bold text-zinc-900">{dbChunksCount}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-[10px]">With Embeddings</div>
              <div className={`text-base font-bold ${chunksWithEmbeddingsCount === dbChunksCount && dbChunksCount > 0 ? 'text-emerald-700' : chunksWithEmbeddingsCount > 0 ? 'text-amber-700' : 'text-zinc-500'}`}>
                {chunksWithEmbeddingsCount}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Audio Capture & MediaRecorder Diagnostics */}
        <section className="mb-5 space-y-2">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-zinc-500" />
            <span>4. Audio Stream & MediaRecorder Diagnostics</span>
          </h4>

          <div className="p-3 rounded-md bg-zinc-50 border border-zinc-200 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span>Recorder State:</span>
              <span className="font-semibold uppercase text-zinc-900">{recSnapshot.state}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Capture Mode:</span>
              <span className="font-semibold text-zinc-700">{recSnapshot.captureMode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Audio Tracks Detected:</span>
              <span className={`font-semibold ${recSnapshot.hasAudioTrack ? 'text-emerald-700' : 'text-amber-600'}`}>
                {recSnapshot.hasAudioTrack ? '✓ YES' : '✗ NONE'}
              </span>
            </div>
            {recSnapshot.errorMessage && (
              <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                {recSnapshot.errorMessage}
              </div>
            )}
          </div>
        </section>

        {/* 5. Real STT Provider Capability */}
        <section className="space-y-2">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
            <span>5. Real Speech-To-Text (STT) Provider Status</span>
          </h4>

          <div className="p-3 rounded-md bg-zinc-50 border border-zinc-200 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span>Configured Provider:</span>
              <span className="font-semibold text-zinc-900">{sttStatus?.name || 'Local STT Engine'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>STT Service Availability:</span>
              <span className={`font-semibold ${sttStatus?.available ? 'text-emerald-700' : 'text-amber-700'}`}>
                {sttStatus?.available ? '● CONNECTED' : '○ UNAVAILABLE'}
              </span>
            </div>
            {sttStatus?.detail && (
              <div className={`p-2.5 rounded text-[11px] leading-relaxed ${sttStatus.available ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-amber-50 border border-amber-200 text-amber-900'}`}>
                {sttStatus.detail}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

