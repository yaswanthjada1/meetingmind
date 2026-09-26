import { db } from '../db';
import { RecordingState, MeetingRecording, TranscriptChunk } from '../types';

export type CaptureMode = 'tab_audio' | 'microphone' | 'upload';

export interface RecordingServiceSnapshot {
  state: RecordingState;
  durationSeconds: number;
  captureMode: CaptureMode;
  activeMeetingId: string | null;
  errorMessage: string | null;
  hasAudioTrack: boolean;
}

type Listener = (snapshot: RecordingServiceSnapshot) => void;

/**
 * Global RecordingManager Singleton
 *
 * Persists independently of React component mount cycles.
 * Navigating between Calendar, Meetings, Resources, Tasks will NOT interrupt recording.
 *
 * Strict Rules Enforced:
 * 1. Must be initiated by direct user activation.
 * 2. Checks getAudioTracks(). If length === 0, stops tracks, sets state = 'ready', and alerts user:
 *    "Audio was not shared. Please select the meeting tab and enable Share tab audio."
 * 3. Timer only advances while mediaRecorder.state === 'recording'.
 * 4. Listens to track.onended to transition to 'stopped' immediately if user ends share.
 * 5. Saves authentic MediaRecorder Blob directly to IndexedDB recordings table.
 */
export class UniversalRecordingManager {
  private state: RecordingState = 'ready';
  private captureMode: CaptureMode = 'tab_audio';
  private activeMeetingId: string | null = null;
  private activeUserId: string = 'default_user';
  private errorMessage: string | null = null;

  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private durationSeconds = 0;
  private timerInterval: any = null;
  private recordingStartTime = 0;

  // Live Speech Recognition (for microphone mode only)
  private liveRecognition: any = null;
  private liveTranscriptChunks: TranscriptChunk[] = [];

  private listeners: Listener[] = [];

  constructor() {
    this.state = 'ready';
  }

  getSnapshot(): RecordingServiceSnapshot {
    return {
      state: this.state,
      durationSeconds: this.durationSeconds,
      captureMode: this.captureMode,
      activeMeetingId: this.activeMeetingId,
      errorMessage: this.errorMessage,
      hasAudioTrack: this.stream ? this.stream.getAudioTracks().length > 0 : false,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const snap = this.getSnapshot();
    this.listeners.forEach((l) => l(snap));
  }

  getLiveTranscriptChunks(): TranscriptChunk[] {
    return [...this.liveTranscriptChunks];
  }

  /**
   * Prepares capture for a given meeting.
   */
  prepareForMeeting(meetingId: string, userId = 'default_user', mode: CaptureMode = 'tab_audio') {
    if (this.state === 'recording' && this.activeMeetingId === meetingId) {
      return;
    }
    this.activeMeetingId = meetingId;
    this.activeUserId = userId;
    this.captureMode = mode;
    this.errorMessage = null;
    if (this.state !== 'recording' && this.state !== 'paused') {
      this.state = 'ready';
      this.durationSeconds = 0;
    }
    this.notify();
  }

  /**
   * Starts capture via Browser Tab / DisplayMedia.
   * MUST be triggered directly by a user click event.
   */
  async startTabAudioCapture(meetingId: string, userId: string): Promise<boolean> {
    this.activeMeetingId = meetingId;
    this.activeUserId = userId;
    this.captureMode = 'tab_audio';
    this.errorMessage = null;
    this.state = 'requesting_permission';
    this.notify();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen / tab audio capture is not supported in this browser.');
      }

      // Explicit browser display capture requesting tab audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        preferCurrentTab: false,
        systemAudio: 'include',
      } as any);

      // MANDATORY VERIFICATION: Check audio tracks
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        // User did not check "Share tab audio"
        displayStream.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.state = 'ready';
        this.errorMessage = 'No audio track was shared. Select the meeting tab and enable Share tab audio.';
        this.notify();
        return false;
      }

      const audioTrack = audioTracks[0];
      if (audioTrack.readyState !== 'live' || !audioTrack.enabled) {
        displayStream.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.state = 'ready';
        this.errorMessage = 'Audio track is not live or enabled.';
        this.notify();
        return false;
      }

      // Stop video track to release display resource & pass audio-only stream to MediaRecorder
      displayStream.getVideoTracks().forEach((t) => t.stop());

      // Create clean audio-only stream
      const audioStream = new MediaStream(audioTracks);
      this.stream = audioStream;

      return this.initializeMediaRecorder();
    } catch (err: any) {
      this.cleanupStream();
      this.state = 'ready';
      this.errorMessage = err?.message?.includes('Permission denied')
        ? 'Capture permission was cancelled.'
        : err?.message || 'Failed to start tab audio capture.';
      this.notify();
      return false;
    }
  }

  /**
   * Starts capture via microphone.
   * Appropriate for in-person meetings.
   */
  async startMicrophoneCapture(meetingId: string, userId: string): Promise<boolean> {
    this.activeMeetingId = meetingId;
    this.activeUserId = userId;
    this.captureMode = 'microphone';
    this.errorMessage = null;
    this.state = 'requesting_permission';
    this.notify();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioTracks = micStream.getAudioTracks();
      if (audioTracks.length === 0) {
        micStream.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.state = 'ready';
        this.errorMessage = 'No microphone audio track detected.';
        this.notify();
        return false;
      }

      const audioTrack = audioTracks[0];
      if (audioTrack.readyState !== 'live' || !audioTrack.enabled) {
        micStream.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.state = 'ready';
        this.errorMessage = 'Microphone track is not live or enabled.';
        this.notify();
        return false;
      }

      this.stream = new MediaStream(audioTracks);

      // Start Web Speech API if supported for genuine live transcription
      this.startLiveSpeechRecognition();

      return this.initializeMediaRecorder();
    } catch (err: any) {
      this.cleanupStream();
      this.state = 'ready';
      this.errorMessage = err?.message?.includes('Permission denied')
        ? 'Microphone permission was denied.'
        : err?.message || 'Failed to access microphone.';
      this.notify();
      return false;
    }
  }

  private getSupportedRecordingMimeType(hasVideo = false): string {
    const audioCandidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    const videoCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];

    const candidates = hasVideo ? videoCandidates : audioCandidates;

    for (const candidate of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
        console.log(`[MediaRecorder] Testing candidate "${candidate}" -> Supported`);
        return candidate;
      } else {
        console.log(`[MediaRecorder] Testing candidate "${candidate}" -> Not supported`);
      }
    }

    return '';
  }

  private initializeMediaRecorder(): boolean {
    if (!this.stream) return false;

    try {
      this.recordedChunks = [];

      const tracksInfo = this.stream.getTracks().map((track) => ({
        kind: track.kind,
        label: track.label,
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted,
      }));

      console.log('[MediaRecorder] Stream tracks:', tracksInfo);
      console.log('[MediaRecorder] Audio tracks count:', this.stream.getAudioTracks().length);
      console.log('[MediaRecorder] Video tracks count:', this.stream.getVideoTracks().length);

      const hasVideo = this.stream.getVideoTracks().length > 0;
      const supportedMime = this.getSupportedRecordingMimeType(hasVideo);

      console.log('[MediaRecorder] Selected MIME type:', supportedMime || '(browser default)');

      const options = supportedMime ? { mimeType: supportedMime } : undefined;
      this.mediaRecorder = new MediaRecorder(this.stream, options);

      console.log('[MediaRecorder] Instantiated recorder mimeType:', this.mediaRecorder.mimeType);
      console.log('[MediaRecorder] Initial state:', this.mediaRecorder.state);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (err) => {
        console.error('[MediaRecorder] error event:', err);
        this.state = 'failed';
        this.errorMessage = 'Media recording encountered an error.';
        this.stopTimer();
        this.notify();
      };

      this.mediaRecorder.onstop = () => {
        this.stopTimer();
      };

      // Listen for browser tab share stop (e.g., user clicks browser "Stop sharing")
      this.stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (this.state === 'recording' || this.state === 'paused') {
            this.stopRecording();
          }
        };
      });

      this.mediaRecorder.start(1000);
      console.log('[MediaRecorder] Started recording. Active state:', this.mediaRecorder.state);

      this.state = 'recording';
      this.durationSeconds = 0;
      this.recordingStartTime = Date.now();
      this.startTimer();
      this.notify();
      return true;
    } catch (err: any) {
      console.error('[MediaRecorder] Initialization exception:', err);
      this.cleanupStream();
      this.state = 'failed';
      this.errorMessage = `MediaRecorder initialization failed: ${err?.message || 'Unknown'}`;
      this.notify();
      return false;
    }
  }

  pauseRecording(): void {
    if (this.state === 'recording' && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.state = 'paused';
      this.stopTimer();
      this.notify();
    }
  }

  resumeRecording(): void {
    if (this.state === 'paused' && this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.state = 'recording';
      this.startTimer();
      this.notify();
    }
  }

  /**
   * Stops recording, collects real MediaRecorder chunks into a Blob,
   * stores the recording record in IndexedDB, and transitions state to 'stopped'.
   */
  async stopRecording(): Promise<MeetingRecording | null> {
    this.stopTimer();
    this.stopLiveSpeechRecognition();

    if (!this.mediaRecorder) {
      this.cleanupStream();
      this.state = 'ready';
      this.notify();
      return null;
    }

    return new Promise((resolve) => {
      const finish = async () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const finalBlob = new Blob(this.recordedChunks, { type: mimeType });

        const meetingId = this.activeMeetingId || `m-${Date.now()}`;
        const recordingId = `rec-${Date.now()}`;
        const duration = Math.max(1, this.durationSeconds);

        const record: MeetingRecording = {
          recordingId,
          meetingId,
          userId: this.activeUserId,
          mimeType,
          size: finalBlob.size,
          duration,
          createdAt: Date.now(),
          blob: finalBlob,
        };

        try {
          await db.recordings.put(record);
          await db.meetings.update(meetingId, {
            recordingId,
            meetingState: 'stopped',
          });
        } catch (dbErr) {
          console.error('Failed to save recording to IndexedDB:', dbErr);
        }

        this.cleanupStream();
        this.state = 'stopped';
        this.notify();
        resolve(record);
      };

      const mr = this.mediaRecorder;
      if (mr && mr.state !== 'inactive') {
        mr.onstop = () => {
          finish();
        };
        mr.stop();
      } else {
        finish();
      }
    });
  }

  cancelRecording(): void {
    this.stopTimer();
    this.stopLiveSpeechRecognition();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanupStream();
    this.recordedChunks = [];
    this.durationSeconds = 0;
    this.state = 'ready';
    this.errorMessage = null;
    this.notify();
  }

  private cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }

  private startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      // STRICT RULE: Timer only advances while mediaRecorder is actively recording
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.durationSeconds += 1;
        this.notify();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Live Speech Recognition for Microphone capture
  private startLiveSpeechRecognition() {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      this.liveTranscriptChunks = [];
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript.trim();
            if (transcript) {
              const mins = Math.floor(this.durationSeconds / 60);
              const secs = this.durationSeconds % 60;
              const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
              this.liveTranscriptChunks.push({
                id: `chunk-${Date.now()}-${this.liveTranscriptChunks.length}`,
                userId: this.activeUserId,
                meetingId: this.activeMeetingId || '',
                timestamp,
                speaker: 'Speaker',
                text: transcript,
                createdAt: Date.now(),
              });
            }
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e);
      };

      recognition.start();
      this.liveRecognition = recognition;
    } catch (e) {
      console.warn('Could not start live SpeechRecognition:', e);
    }
  }

  private stopLiveSpeechRecognition() {
    if (this.liveRecognition) {
      try {
        this.liveRecognition.stop();
      } catch (e) {}
      this.liveRecognition = null;
    }
  }
}

export const recordingManager = new UniversalRecordingManager();
