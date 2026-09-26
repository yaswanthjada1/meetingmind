import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Decision, Commitment, Meeting } from '../types';
import { searchLocalMemory, RetrievedMemoryItem } from '../services/memory';
import {
  Search,
  Brain,
  History,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Shield,
  HelpCircle,
} from 'lucide-react';

interface MemoryViewProps {
  onSelectMeeting: (meetingId: string) => void;
}

export const MemoryView: React.FC<MemoryViewProps> = ({ onSelectMeeting }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RetrievedMemoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'decisions' | 'commitments'>('timeline');

  const [allDecisions, setAllDecisions] = useState<Decision[]>([]);
  const [allCommitments, setAllCommitments] = useState<Commitment[]>([]);
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);

  const loadData = async () => {
    const [d, c, m] = await Promise.all([
      db.decisions.toArray(),
      db.commitments.toArray(),
      db.meetings.orderBy('date').reverse().toArray(),
    ]);
    setAllDecisions(d);
    setAllCommitments(c);
    setAllMeetings(m);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const res = await searchLocalMemory(q, 6);
    setSearchResults(res);
    setIsSearching(false);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-in fade-in duration-200">
      {/* Top Title & Semantic Search Box */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 tracking-tight">
          Persistent Meeting Memory
        </h1>
        <p className="text-xs text-stone-500 font-sans mt-0.5">
          Local vector TF-IDF memory index • Cross-meeting reasoning & evidence retrieval
        </p>

        {/* Search Bar */}
        <div className="relative mt-5">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search decisions, commitments, or topics (e.g. 'authentication', 'PostgreSQL', 'Rahul')..."
            className="w-full text-sm pl-10 pr-24 py-3 rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-stone-900/10 shadow-2xs font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-3 text-xs text-stone-400 hover:text-stone-700 px-2 py-0.5 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Semantic Search Results (if query active) */}
      {searchQuery.trim() && (
        <div className="mb-10 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3 text-xs font-mono uppercase tracking-wider text-stone-500">
            <span>Retrieved Evidence ({searchResults.length} matches)</span>
            <span className="text-[10px] text-emerald-700 font-normal">IndexedDB Local Match</span>
          </div>

          {searchResults.length === 0 ? (
            <div className="paper-sheet rounded-xl p-6 text-center text-xs text-stone-500 font-mono">
              No matching memory entries found for "{searchQuery}".
            </div>
          ) : (
            <div className="space-y-2.5">
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => item.sourceMeetingId && onSelectMeeting(item.sourceMeetingId)}
                  className="paper-sheet rounded-xl p-4 hover:border-stone-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                      {item.category}
                    </span>
                    <span className="font-mono text-[11px] text-stone-400">
                      Relevance: {(item.score * 100).toFixed(0)}%
                    </span>
                  </div>

                  <p className="text-sm font-medium text-stone-900 group-hover:text-amber-950 mb-2">
                    {item.content}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-500 font-mono">
                    <span>Source: {item.sourceMeetingTitle} ({item.date})</span>
                    <span className="flex items-center gap-1 text-amber-800 text-[11px] font-sans group-hover:underline">
                      Open Meeting <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub navigation for Memory View */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-3 mb-6">
        {(
          [
            { id: 'timeline', label: 'Memory Timeline' },
            { id: 'decisions', label: `Decisions Archive (${allDecisions.length})` },
            { id: 'commitments', label: `Commitments & Deadlines (${allCommitments.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? 'bg-stone-900 text-stone-50'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Memory Timeline View */}
      {activeTab === 'timeline' && (
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-stone-200">
          {allMeetings.map((meet) => (
            <div key={meet.id} className="relative group">
              {/* Timeline marker */}
              <div className="absolute -left-6 sm:-left-8 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-amber-600 shadow-2xs" />

              <div className="paper-sheet rounded-xl p-5 hover:border-stone-400 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <span className="font-mono text-xs font-semibold text-amber-900">
                    {meet.date}
                  </span>
                  <button
                    onClick={() => onSelectMeeting(meet.id)}
                    className="text-xs text-stone-500 hover:text-stone-900 font-sans flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>View original meeting</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <h3
                  onClick={() => onSelectMeeting(meet.id)}
                  className="font-serif text-lg font-semibold text-stone-900 hover:text-amber-900 cursor-pointer mb-2"
                >
                  {meet.title}
                </h3>

                {/* Key decisions extracted */}
                {meet.decisions && meet.decisions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-100">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-semibold block mb-1.5">
                      Decisions Made
                    </span>
                    <div className="space-y-1.5">
                      {meet.decisions.map((d) => (
                        <div key={d.id} className="text-xs text-stone-800 flex items-start gap-1.5">
                          <span className="text-emerald-600 font-bold">•</span>
                          <span><strong>{d.decision}</strong> {d.reason ? `— ${d.reason}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commitments recorded */}
                {meet.commitments && meet.commitments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-100">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-semibold block mb-1.5">
                      Commitments
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      {meet.commitments.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-stone-700">
                          <span className="font-semibold text-stone-900">{c.owner}</span>
                          <span className="text-stone-400">→</span>
                          <span className={c.status === 'completed' ? 'line-through text-stone-400' : ''}>
                            {c.task}
                          </span>
                          <span className="text-stone-400">({c.deadline || 'Upcoming'})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Decisions Archive */}
      {activeTab === 'decisions' && (
        <div className="space-y-3">
          {allDecisions.map((dec) => (
            <div key={dec.id} className="paper-sheet rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-stone-400">{dec.date}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {dec.status}
                </span>
              </div>
              <h4 className="font-serif text-base font-semibold text-stone-900 mb-1.5">
                {dec.decision}
              </h4>
              {dec.reason && (
                <p className="text-xs text-stone-600 mb-2 leading-relaxed">
                  <span className="font-medium text-stone-700">Reason: </span>
                  {dec.reason}
                </p>
              )}
              {dec.alternatives && dec.alternatives.length > 0 && (
                <p className="text-[11px] text-stone-400 mb-3">
                  Alternatives evaluated: {dec.alternatives.join(', ')}
                </p>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs text-stone-500 font-mono">
                <span>Participants: {dec.participants.join(', ')}</span>
                <button
                  onClick={() => onSelectMeeting(dec.sourceMeetingId)}
                  className="text-amber-800 hover:underline flex items-center gap-1 font-sans"
                >
                  Source: {dec.sourceMeetingTitle || 'Meeting'}
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Commitments Tracker */}
      {activeTab === 'commitments' && (
        <div className="space-y-3">
          {allCommitments.map((com) => {
            const isOverdue = com.status === 'overdue';
            const isCompleted = com.status === 'completed';

            return (
              <div
                key={com.id}
                className={`paper-sheet rounded-xl p-5 border ${
                  isOverdue ? 'bg-rose-50/30 border-rose-200' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-stone-900">{com.owner}</span>
                    <span className="text-stone-400 font-mono text-xs">→</span>
                    <span className={`text-sm ${isCompleted ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                      {com.task}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-stone-500">Target: {com.deadline || 'Upcoming'}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isOverdue
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {com.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs text-stone-500 font-mono">
                  <span>Confidence: {(com.confidence * 100).toFixed(0)}%</span>
                  <button
                    onClick={() => com.sourceMeetingId && onSelectMeeting(com.sourceMeetingId)}
                    className="text-amber-800 hover:underline flex items-center gap-1 font-sans"
                  >
                    Source: {com.sourceMeetingTitle || 'Meeting'}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
