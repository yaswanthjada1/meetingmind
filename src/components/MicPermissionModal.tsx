import React from 'react';
import { Mic, X, ShieldCheck } from 'lucide-react';
import { db } from '../db';

interface MicPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGranted: () => void;
}

export const MicPermissionModal: React.FC<MicPermissionModalProps> = ({
  isOpen,
  onClose,
  onGranted,
}) => {
  if (!isOpen) return null;

  const handleRequestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      console.log('Mic prompt handled');
    }

    const settings = await db.settings.get('current_settings');
    if (settings) {
      settings.micPermissionGranted = true;
      await db.settings.put(settings);
    }

    onGranted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-sm w-full p-6 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-800 flex items-center justify-center mx-auto mb-3">
          <Mic className="w-5 h-5" />
        </div>

        <h3 className="text-base font-semibold text-zinc-900 mb-1.5">
          Microphone access
        </h3>
        <p className="text-xs text-zinc-500 leading-relaxed mb-6">
          MeetingMind can automatically record and transcribe your MeetingMind-hosted meetings locally. All audio and notes remain 100% on your device.
        </p>

        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 rounded-md hover:bg-zinc-100 transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleRequestMic}
            className="px-4 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-black rounded-md transition-colors shadow-2xs"
          >
            Allow microphone
          </button>
        </div>
      </div>
    </div>
  );
};
