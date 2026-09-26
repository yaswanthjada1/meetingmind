import { TranscriptChunk } from '../types';

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  async startRecording(onAudioLevel?: (level: number) => void): Promise<boolean> {
    try {
      this.audioChunks = [];
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup audio analyzer for waveform visualizer
      if (onAudioLevel) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          onAudioLevel(avg / 255);
          if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            requestAnimationFrame(checkLevel);
          }
        };
        requestAnimationFrame(checkLevel);
      }

      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000);
      return true;
    } catch (err) {
      console.warn('Microphone access unavailable or denied:', err);
      return false;
    }
  }

  stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
        }
        if (this.audioContext) {
          this.audioContext.close();
        }
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }
}

export const audioRecorder = new AudioRecorderService();

/**
 * Generates realistic segmented transcript chunks for a live or transcribed meeting.
 */
export function generateTranscriptFromText(
  rawText: string,
  meetingId: string,
  participants: string[]
): TranscriptChunk[] {
  const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
  const chunks: TranscriptChunk[] = [];
  let currentMinute = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const speaker = participants[i % participants.length] || `Speaker ${(i % 3) + 1}`;
    const timestamp = `${String(Math.floor(currentMinute / 60)).padStart(2, '0')}:${String(currentMinute % 60).padStart(2, '0')}`;

    chunks.push({
      id: `tc-${Date.now()}-${i}`,
      meetingId,
      timestamp,
      speaker,
      text: line,
      createdAt: Date.now() + i * 1000,
    });

    currentMinute += Math.floor(Math.random() * 2) + 1;
  }

  return chunks;
}
