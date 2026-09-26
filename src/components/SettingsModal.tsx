import React, { useState, useEffect } from 'react';
import { db, DEFAULT_SETTINGS } from '../db';
import { AppSettings, DelegatePermissions } from '../types';
import { checkOllamaHealth } from '../services/llm';
import {
  Shield,
  Database,
  Download,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  Lock,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReloadData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onReloadData,
}) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ollamaStatus, setOllamaStatus] = useState<{ testing: boolean; ok?: boolean; msg?: string }>({
    testing: false,
  });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const s = await db.settings.get('current_settings');
      if (s) setSettings(s);
    };
    if (isOpen) load();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestOllama = async () => {
    setOllamaStatus({ testing: true });
    const health = await checkOllamaHealth(settings.ollamaEndpoint);
    if (health.ok) {
      setOllamaStatus({
        testing: false,
        ok: true,
        msg: `Connected! Available models: ${health.models.slice(0, 3).join(', ')}`,
      });
    } else {
      setOllamaStatus({
        testing: false,
        ok: false,
        msg: `Ollama unavailable at ${settings.ollamaEndpoint} (${health.error}). Local fallback engine is active.`,
      });
    }
  };

  const handleSaveSettings = async () => {
    await db.settings.put(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleExportData = async () => {
    const [meetings, transcripts, decisions, commitments, tasks, resources, delegateSessions] = await Promise.all([
      db.meetings.toArray(),
      db.transcripts.toArray(),
      db.decisions.toArray(),
      db.commitments.toArray(),
      db.tasks.toArray(),
      db.resources.toArray(),
      db.delegateSessions.toArray(),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      meetings,
      transcripts,
      decisions,
      commitments,
      tasks,
      resources,
      delegateSessions,
      settings,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meetingmind-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all locally stored meeting notes and resources?')) {
      await Promise.all([
        db.meetings.clear(),
        db.transcripts.clear(),
        db.decisions.clear(),
        db.commitments.clear(),
        db.tasks.clear(),
        db.resources.clear(),
        db.memories.clear(),
        db.delegateSessions.clear(),
      ]);
      onReloadData();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto text-xs text-zinc-700">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded bg-zinc-100 text-zinc-800">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-900">Settings & Privacy</h3>
            <p className="text-[11px] text-zinc-400 font-mono">
              🔒 Your meeting data is stored locally in IndexedDB on this device.
            </p>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="mb-6 p-3 rounded-md bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-600 leading-relaxed font-sans">
          <strong>Local-First Guarantee:</strong> Firebase is used solely for authentication and user identity. All meetings, transcripts, RAG documents, and vector embeddings remain strictly in your browser's local IndexedDB.
        </div>

        {/* Developer / AI Model Config */}
        <div className="space-y-3 mb-6 pb-6 border-b border-zinc-100">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-zinc-400" />
            <span>Developer / AI Model Configuration</span>
          </h4>

          <div>
            <label className="block text-[11px] font-mono text-zinc-500 mb-1">Ollama API Endpoint</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.ollamaEndpoint}
                onChange={(e) => setSettings({ ...settings, ollamaEndpoint: e.target.value })}
                className="flex-1 text-xs px-3 py-1.5 rounded-md border border-zinc-200 font-mono"
                placeholder="http://localhost:11434"
              />
              <button
                onClick={handleTestOllama}
                disabled={ollamaStatus.testing}
                className="px-3 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md border border-zinc-300"
              >
                {ollamaStatus.testing ? 'Testing...' : 'Test'}
              </button>
            </div>
            {ollamaStatus.msg && (
              <p className={`text-[10px] font-mono mt-1 ${ollamaStatus.ok ? 'text-emerald-700' : 'text-zinc-500'}`}>
                {ollamaStatus.msg}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-500 mb-1">Model Name</label>
            <input
              type="text"
              value={settings.ollamaModel}
              onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
              className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 font-mono"
              placeholder="qwen2.5:3b"
            />
          </div>
        </div>

        {/* User Identity */}
        <div className="space-y-3 mb-6 pb-6 border-b border-zinc-100">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">User Identity</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-zinc-500 mb-1">Name</label>
              <input
                type="text"
                value={settings.userProfile.name}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    userProfile: { ...settings.userProfile, name: e.target.value },
                  })
                }
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-zinc-500 mb-1">Role</label>
              <input
                type="text"
                value={settings.userProfile.role}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    userProfile: { ...settings.userProfile, role: e.target.value },
                  })
                }
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200"
              />
            </div>
          </div>
        </div>

        {/* Local Data Management */}
        <div className="space-y-2.5 mb-6">
          <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">Local Storage</h4>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-md shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Export Local Backup (JSON)</span>
            </button>

            <button
              onClick={handleClearData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear IndexedDB</span>
            </button>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          {isSaved ? (
            <span className="text-xs text-emerald-700 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
            >
              Close
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-md hover:bg-black"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
