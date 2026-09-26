import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings as SettingsIcon, Play, HelpCircle, ChevronDown, Database, Trash2, Loader2 } from 'lucide-react';
import { AuthUser } from '../services/firebase';
import { processingQueue, ProcessingJob } from '../services/processingPipeline';
import { checkOllamaHealth, OllamaHealthStatus } from '../services/llm';

interface HeaderProps {
  activeTab: 'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate';
  setActiveTab: (tab: 'calendar' | 'meetings' | 'resources' | 'tasks' | 'delegate') => void;
  currentUser: AuthUser | null;
  onOpenSettings: () => void;
  onOpenDiagnostics?: () => void;
  onSignOut: () => void;
  onOpenLogin: () => void;
  onSelectMeeting?: (meetingId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenSettings,
  onOpenDiagnostics,
  onSignOut,
  onOpenLogin,
  onSelectMeeting,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isQueueMenuOpen, setIsQueueMenuOpen] = useState(false);
  const [activeJobs, setActiveJobs] = useState<ProcessingJob[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaHealthStatus | null>(null);
  const [isAiStatusOpen, setIsAiStatusOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Initial & interval check of local Ollama models
    const checkModels = async () => {
      const status = await checkOllamaHealth();
      setOllamaStatus(status);
    };
    checkModels();
    const interval = setInterval(checkModels, 15000);

    const unsub = processingQueue.subscribe((jobs) => {
      setActiveJobs(jobs.filter((j) => j.status !== 'completed' && j.status !== 'error' && j.status !== 'transcription_unavailable'));
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (queueRef.current && !queueRef.current.contains(e.target as Node)) {
        setIsQueueMenuOpen(false);
      }
      if (aiRef.current && !aiRef.current.contains(e.target as Node)) {
        setIsAiStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearInterval(interval);
      unsub();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navItems = [
    { id: 'calendar', label: 'Calendar' },
    { id: 'meetings', label: 'Meetings' },
    { id: 'resources', label: 'Resources' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'delegate', label: 'Delegate' },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-6 h-13 flex items-center justify-between transition-colors">
      {/* Brand & Minimal Nav */}
      <div className="flex items-center gap-8">
        {/* Brand */}
        <button
          onClick={() => setActiveTab('calendar')}
          className="flex items-center gap-2 text-zinc-900 hover:opacity-80 transition-opacity text-left group"
        >
          <span className="font-semibold text-base tracking-tight text-zinc-900 font-sans">
            MeetingMind
          </span>

        </button>

        {/* Minimal Navigation */}
        <nav className="hidden sm:flex items-center space-x-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${isActive
                    ? 'text-zinc-900 bg-zinc-100 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right Side: Local AI Status + Processing Status + Account Menu */}
      <div className="flex items-center gap-2.5">
        {/* Local AI Model Availability Indicator */}
        <div className="relative" ref={aiRef}>
          <button
            onClick={() => setIsAiStatusOpen(!isAiStatusOpen)}
            className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md border transition-colors shadow-2xs ${
              ollamaStatus?.isFullyReady
                ? 'text-emerald-800 bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100'
                : !ollamaStatus?.ok
                ? 'text-zinc-600 bg-zinc-100 border-zinc-200 hover:bg-zinc-200'
                : 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100'
            }`}
            title="Local AI Status"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                ollamaStatus?.isFullyReady
                  ? 'bg-emerald-600'
                  : !ollamaStatus?.ok
                  ? 'bg-zinc-400'
                  : 'bg-amber-500'
              }`}
            />
            <span className="hidden md:inline font-medium">
              {ollamaStatus?.isFullyReady
                ? 'Local AI Ready'
                : !ollamaStatus?.ok
                ? 'Local AI Offline'
                : `Missing ${ollamaStatus?.missingRequired[0] || 'Model'}`}
            </span>
          </button>

          {isAiStatusOpen && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white border border-zinc-200 rounded-lg shadow-xl p-3.5 text-xs z-50 animate-in fade-in-50 duration-100 font-sans">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100">
                <span className="font-semibold text-zinc-900">Local AI Engine</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    ollamaStatus?.isFullyReady
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {ollamaStatus?.isFullyReady ? 'Ready' : 'Offline'}
                </span>
              </div>

              <div className="space-y-1.5 text-zinc-600 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>Reasoning:</span>
                  <span className="font-mono text-zinc-900 font-medium">
                    {ollamaStatus?.hasPrimaryReasoning ? 'qwen3:8b ✓' : 'Missing ✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fast Operations:</span>
                  <span className="font-mono text-zinc-900 font-medium">
                    {ollamaStatus?.hasFastModel ? 'qwen3:1.7b ✓' : 'Missing ✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>RAG Embeddings:</span>
                  <span className="font-mono text-zinc-900 font-medium">
                    {ollamaStatus?.hasEmbeddingModel ? 'qwen3-embedding:0.6b ✓' : 'Missing ✗'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 font-mono">Target: /ollama</span>
                {onOpenDiagnostics && (
                  <button
                    onClick={() => {
                      setIsAiStatusOpen(false);
                      onOpenDiagnostics();
                    }}
                    className="text-[10px] font-mono font-medium text-zinc-900 hover:underline"
                  >
                    Run System Diagnostics →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Background Processing Indicator Pill */}
        {activeJobs.length > 0 && (
          <div className="relative" ref={queueRef}>
            <button
              onClick={() => setIsQueueMenuOpen(!isQueueMenuOpen)}
              className="flex items-center gap-1.5 text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md shadow-2xs hover:bg-amber-100 transition-colors"
            >
              <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>Processing ({activeJobs.length})</span>
            </button>

            {isQueueMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white border border-zinc-200 rounded-lg shadow-xl p-3 text-xs z-50 animate-in fade-in-50 duration-100 font-sans">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100">
                  <span className="font-semibold text-zinc-800">Background Processing</span>
                  <span className="text-[10px] font-mono text-zinc-400">{activeJobs.length} active</span>
                </div>
                <div className="space-y-2">
                  {activeJobs.map((job) => (
                    <div
                      key={job.meetingId}
                      onClick={() => {
                        setIsQueueMenuOpen(false);
                        onSelectMeeting?.(job.meetingId);
                      }}
                      className="p-2 rounded bg-zinc-50 hover:bg-zinc-100 cursor-pointer border border-zinc-200/60"
                    >
                      <div className="font-medium text-zinc-900 truncate">{job.meetingTitle}</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{job.step}</div>
                      <div className="w-full bg-zinc-200 h-1 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-zinc-900 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile Navigation Dropdown for small screens */}
        <div className="sm:hidden">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="text-xs px-2 py-1 rounded border border-zinc-200 bg-white text-zinc-800"
          >
            {navItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {currentUser ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 rounded-full hover:bg-zinc-100 transition-colors border border-transparent hover:border-zinc-200"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-zinc-100 flex items-center justify-center font-medium text-xs">
                {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
              <span className="hidden md:inline text-xs font-medium text-zinc-700 max-w-[100px] truncate">
                {currentUser.displayName || 'User'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {/* User Dropdown */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 text-xs text-zinc-700 z-50 animate-in fade-in-50 duration-100 font-sans">
                <div className="px-3 py-2 border-b border-zinc-100">
                  <p className="font-semibold text-zinc-900 truncate">
                    {currentUser.displayName || 'User'}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate font-mono">
                    {currentUser.email || ''}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-700"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Settings & Privacy</span>
                </button>

                <div className="border-t border-zinc-100 my-1" />

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-zinc-600 hover:text-rose-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="px-3 py-1.5 text-xs font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
};
