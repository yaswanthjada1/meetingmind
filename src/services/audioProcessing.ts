/**
 * AudioProcessingService
 *
 * Real Web Audio API processor:
 * 1. Decodes audio Blob into PCM samples using AudioContext.decodeAudioData().
 * 2. Detects leading & trailing silence and trims silence boundaries.
 * 3. Normalizes peak audio levels across channels to standard volume (-1 dB / 0.9 peak).
 * 4. Encodes processed audio back into a clean WAV audio Blob.
 */

export interface CleanedAudioResult {
  cleanedBlob: Blob;
  originalDurationSec: number;
  cleanedDurationSec: number;
  peakLevelBefore: number;
  peakLevelAfter: number;
  silenceTrimmedSec: number;
}

export class AudioProcessingService {
  /**
   * Cleans, trims silence, and normalizes audio data.
   */
  async cleanAudio(blob: Blob): Promise<CleanedAudioResult> {
    if (!blob || blob.size === 0) {
      throw new Error('Cannot process empty audio blob.');
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      // If Web Audio API is unsupported in current environment, return original
      return {
        cleanedBlob: blob,
        originalDurationSec: 0,
        cleanedDurationSec: 0,
        peakLevelBefore: 1,
        peakLevelAfter: 1,
        silenceTrimmedSec: 0,
      };
    }

    const audioContext = new AudioCtx();

    try {
      const arrayBuffer = await blob.arrayBuffer();
      // decodeAudioData consumes the buffer, so slice a copy
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

      const originalDurationSec = audioBuffer.duration;
      const numChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const length = audioBuffer.length;

      if (length === 0) {
        return {
          cleanedBlob: blob,
          originalDurationSec: 0,
          cleanedDurationSec: 0,
          peakLevelBefore: 0,
          peakLevelAfter: 0,
          silenceTrimmedSec: 0,
        };
      }

      // 1. Measure peak level across all channels
      let peakBefore = 0;
      const channelsData: Float32Array[] = [];

      for (let ch = 0; ch < numChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        channelsData.push(data);
        for (let i = 0; i < length; i++) {
          const abs = Math.abs(data[i]);
          if (abs > peakBefore) peakBefore = abs;
        }
      }

      // 2. Silence detection: threshold based on peak (or minimum 0.01)
      const silenceThreshold = Math.max(0.01, peakBefore * 0.03);

      // Find first audible sample (leading silence)
      let startIndex = 0;
      findStart: for (let i = 0; i < length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          if (Math.abs(channelsData[ch][i]) > silenceThreshold) {
            startIndex = Math.max(0, i - Math.floor(sampleRate * 0.05)); // Keep 50ms pre-roll
            break findStart;
          }
        }
      }

      // Find last audible sample (trailing silence)
      let endIndex = length - 1;
      findEnd: for (let i = length - 1; i >= startIndex; i--) {
        for (let ch = 0; ch < numChannels; ch++) {
          if (Math.abs(channelsData[ch][i]) > silenceThreshold) {
            endIndex = Math.min(length - 1, i + Math.floor(sampleRate * 0.05)); // Keep 50ms tail
            break findEnd;
          }
        }
      }

      // If entirely silent, take whole buffer
      if (endIndex <= startIndex) {
        startIndex = 0;
        endIndex = length - 1;
      }

      const trimmedLength = endIndex - startIndex + 1;
      const cleanedDurationSec = trimmedLength / sampleRate;
      const silenceTrimmedSec = Math.max(0, originalDurationSec - cleanedDurationSec);

      // 3. Normalization multiplier (target 0.90 to avoid clipping)
      const targetPeak = 0.90;
      const gain = peakBefore > 0.001 ? Math.min(3.0, targetPeak / peakBefore) : 1.0;
      const peakAfter = Math.min(1.0, peakBefore * gain);

      // Create new trimmed and normalized buffer
      const cleanedBuffer = audioContext.createBuffer(numChannels, trimmedLength, sampleRate);

      for (let ch = 0; ch < numChannels; ch++) {
        const srcData = channelsData[ch];
        const destData = cleanedBuffer.getChannelData(ch);
        for (let i = 0; i < trimmedLength; i++) {
          const sample = srcData[startIndex + i] * gain;
          // Soft clamp to [-1, 1]
          destData[i] = Math.max(-1.0, Math.min(1.0, sample));
        }
      }

      // 4. Encode AudioBuffer to standard WAV Blob
      const wavBlob = audioBufferToWav(cleanedBuffer);

      return {
        cleanedBlob: wavBlob,
        originalDurationSec,
        cleanedDurationSec,
        peakLevelBefore: peakBefore,
        peakLevelAfter: peakAfter,
        silenceTrimmedSec,
      };
    } finally {
      audioContext.close();
    }
  }
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Write WAV Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and write 16-bit PCM samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      // Convert float [-1, 1] to 16-bit signed integer [-32768, 32767]
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const audioProcessingService = new AudioProcessingService();
