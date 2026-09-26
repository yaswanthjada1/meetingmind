import { TranscriptChunk } from '../types';
import { audioProcessingService } from './audioProcessing';

export interface TranscriptSegment {
  id?: string;
  startSec?: number;
  endSec?: number;
  speaker?: string; // ONLY if actual STT provider supports speaker diarization
  text: string;
  timestamp?: string;
}

export interface STTProviderStatus {
  name: string;
  available: boolean;
  providerType: 'whisper_local' | 'web_speech_api' | 'uploaded_notes' | 'none';
  endpoint?: string;
  detail?: string;
}

export interface TranscriptionResult {
  success: boolean;
  available: boolean;
  text: string;
  chunks: TranscriptChunk[];
  segments?: TranscriptSegment[];
  durationMs?: number;
  error?: string;
  reason?: string;
}

export interface ITranscriptionProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<STTProviderStatus>;
  transcribe(options: {
    audioBlob?: Blob;
    liveTranscriptChunks?: TranscriptChunk[];
    uploadedNotes?: string;
    meetingId: string;
    userId: string;
    participants: string[];
  }): Promise<TranscriptionResult>;
}

/**
 * Live Browser SpeechRecognition provider.
 * Active ONLY when browser SpeechRecognition captured genuine live user microphone speech.
 */
export class BrowserLiveSpeechProvider implements ITranscriptionProvider {
  name = 'Browser Web Speech API';

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  async getStatus(): Promise<STTProviderStatus> {
    const available = await this.isAvailable();
    return {
      name: this.name,
      available,
      providerType: 'web_speech_api',
      detail: available ? 'Browser Web Speech API supported' : 'Browser Web Speech API unsupported',
    };
  }

  async transcribe(options: {
    liveTranscriptChunks?: TranscriptChunk[];
  }): Promise<TranscriptionResult> {
    if (options.liveTranscriptChunks && options.liveTranscriptChunks.length > 0) {
      const text = options.liveTranscriptChunks.map((c) => `${c.speaker} (${c.timestamp}): ${c.text}`).join('\n');
      return {
        success: true,
        available: true,
        text,
        chunks: options.liveTranscriptChunks,
      };
    }

    return {
      success: false,
      available: false,
      text: '',
      chunks: [],
      reason: 'No live speech recognition stream was captured.',
    };
  }
}

/**
 * Uploaded Notes / Transcript provider.
 * Active when user provided an actual text/notes file (.txt, .md, .csv).
 */
export class UploadedNotesTranscriptionProvider implements ITranscriptionProvider {
  name = 'Uploaded Meeting Notes / Transcript';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<STTProviderStatus> {
    return {
      name: this.name,
      available: true,
      providerType: 'uploaded_notes',
      detail: 'Parses uploaded text, markdown, or CSV transcript notes',
    };
  }

  async transcribe(options: {
    uploadedNotes?: string;
    meetingId: string;
    userId: string;
    participants: string[];
  }): Promise<TranscriptionResult> {
    const raw = (options.uploadedNotes || '').trim();
    if (!raw) {
      return {
        success: false,
        available: false,
        text: '',
        chunks: [],
        reason: 'No uploaded notes or text content provided.',
      };
    }

    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const chunks: TranscriptChunk[] = lines.map((line, idx) => {
      const hasColon = line.includes(':');
      const speaker = hasColon ? line.split(':')[0].trim() : 'Speaker';
      const text = hasColon ? line.split(':').slice(1).join(':').trim() : line;
      const mins = Math.floor((idx * 2) / 60);
      const secs = (idx * 2) % 60;
      const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      return {
        id: `tc-${options.meetingId}-${idx}-${Date.now()}`,
        userId: options.userId,
        meetingId: options.meetingId,
        speaker,
        text,
        timestamp,
        createdAt: Date.now() + idx,
      };
    });

    return {
      success: true,
      available: true,
      text: raw,
      chunks,
    };
  }
}

/**
 * Local STT / Whisper service provider.
 * Inspects if an actual local Whisper or STT HTTP endpoint is configured and reachable on this machine.
 * Performs real WAV audio conversion if needed.
 * Strictly adheres to rule: NEVER fabricate transcripts or pretend an LLM is an STT model.
 */
export class LocalSpeechToTextProvider implements ITranscriptionProvider {
  name = 'Local Whisper / STT Service';

  async isAvailable(): Promise<boolean> {
    const status = await this.getStatus();
    return status.available;
  }

  async getStatus(): Promise<STTProviderStatus> {
    // Check known local Whisper ports / endpoints (e.g. faster-whisper-server, whisper.cpp HTTP server)
    const endpoints = [
      'http://localhost:9000/asr',
      'http://localhost:8080/inference',
      'http://localhost:5000/transcribe',
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(ep, { method: 'GET', signal: controller.signal });
        clearTimeout(t);
        if (res.ok || res.status === 405) {
          return {
            name: 'Local Whisper HTTP Server',
            available: true,
            providerType: 'whisper_local',
            endpoint: ep,
            detail: `Connected to local Whisper service at ${ep}`,
          };
        }
      } catch (e) {
        // Not running on this port
      }
    }

    return {
      name: 'Local STT Engine',
      available: false,
      providerType: 'none',
      detail:
        'No local STT provider is currently configured. To enable offline speech-to-text, launch a local Whisper HTTP server (e.g. faster-whisper-server or whisper.cpp on http://localhost:9000/asr).',
    };
  }

  async transcribe(options: {
    audioBlob?: Blob;
    liveTranscriptChunks?: TranscriptChunk[];
    uploadedNotes?: string;
    meetingId: string;
    userId: string;
    participants: string[];
  }): Promise<TranscriptionResult> {
    // 1. If genuine live transcript chunks were captured during the meeting via browser Web Speech API
    if (options.liveTranscriptChunks && options.liveTranscriptChunks.length > 0) {
      const text = options.liveTranscriptChunks.map((c) => `${c.speaker} (${c.timestamp}): ${c.text}`).join('\n');
      return {
        success: true,
        available: true,
        text,
        chunks: options.liveTranscriptChunks,
      };
    }

    // 2. If uploaded notes/transcript text was provided, parse structured text
    if (options.uploadedNotes && options.uploadedNotes.trim().length > 0) {
      const notesProvider = new UploadedNotesTranscriptionProvider();
      return notesProvider.transcribe(options);
    }

    // 3. Check for configured local Whisper HTTP service
    const status = await this.getStatus();
    if (status.available && status.endpoint && options.audioBlob && options.audioBlob.size > 0) {
      try {
        let payloadBlob = options.audioBlob;
        try {
          const cleaned = await audioProcessingService.cleanAudio(options.audioBlob);
          payloadBlob = cleaned.cleanedBlob;
        } catch (convErr) {
          console.warn('Audio conversion warning for STT:', convErr);
        }

        const formData = new FormData();
        formData.append('file', payloadBlob, 'recording.wav');

        const res = await fetch(status.endpoint, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = (data.text || data.transcript || '').trim();
          if (rawText) {
            const lines = rawText.split('\n').filter((l: string) => l.trim().length > 0);
            const chunks: TranscriptChunk[] = lines.map((line: string, idx: number) => {
              const mins = Math.floor((idx * 5) / 60);
              const secs = (idx * 5) % 60;
              const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
              return {
                id: `tc-${options.meetingId}-${idx}-${Date.now()}`,
                userId: options.userId,
                meetingId: options.meetingId,
                speaker: 'Speaker', // Neutral speaker, no fake names
                text: line.trim(),
                timestamp,
                createdAt: Date.now() + idx,
              };
            });

            return {
              success: true,
              available: true,
              text: rawText,
              chunks,
            };
          }
        }
      } catch (err: any) {
        console.warn('Local Whisper API call failed:', err);
      }
    }

    // 4. Honest fallback when no STT service is configured
    return {
      success: false,
      available: false,
      text: '',
      chunks: [],
      reason: status.detail || 'No local STT provider is currently configured.',
    };
  }
}

export const defaultTranscriptionProvider = new LocalSpeechToTextProvider();
