import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ResourceDocument, ResourceCategory } from '../types';
import { AddResourceModal } from './AddResourceModal';
import { ResourceDetailModal } from './ResourceDetailModal';
import {
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  ExternalLink,
  FileCode,
  FileCheck,
  AlertCircle,
  Tag,
  ShieldCheck,
  Database,
} from 'lucide-react';

interface ResourcesViewProps {
  userId?: string;
  onAskAboutResource?: (resourceTitle: string) => void;
}

const CATEGORIES: ResourceCategory[] = [
  'All',
  'Projects',
  'Work',
  'Personal',
  'Technical',
  'Meeting Material',
  'Other',
];

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  userId = 'default_user',
  onAskAboutResource,
}) => {
  const resources = useLiveQuery<ResourceDocument[]>(
    () => (userId ? db.resources.where('userId').equals(userId).reverse().sortBy('uploadedAt') : Promise.resolve<ResourceDocument[]>([])),
    [userId]
  ) || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ResourceDocument | null>(null);

  const filtered = resources.filter((r) => {
    // Category filter
    if (selectedCategory !== 'All' && r.category !== selectedCategory) {
      return false;
    }

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesName = (r.name || r.title || '').toLowerCase().includes(q);
    const matchesFile = (r.filename || '').toLowerCase().includes(q);
    const matchesDesc = (r.description || '').toLowerCase().includes(q);
    const matchesTags = (r.tags || []).some((t) => t.toLowerCase().includes(q));
    const matchesContent = (r.contentSnippet || '').toLowerCase().includes(q);

    return matchesName || matchesFile || matchesDesc || matchesTags || matchesContent;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const renderFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <span className="text-[10px] font-mono font-bold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">PDF</span>;
      case 'docx':
        return <span className="text-[10px] font-mono font-bold text-blue-700 uppercase bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">DOCX</span>;
      case 'md':
        return <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">MD</span>;
      case 'txt':
        return <span className="text-[10px] font-mono font-bold text-zinc-700 uppercase bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">TXT</span>;
      case 'csv':
        return <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">CSV</span>;
      default:
        return <span className="text-[10px] font-mono font-bold text-zinc-700 uppercase bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">DOC</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 font-sans animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="mb-6 pb-4 border-b border-zinc-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Resources</h1>
            <p className="text-xs text-zinc-500 mt-1 max-w-xl leading-relaxed">
              Your personal local knowledge base. Upload documents, notes and specifications you want MeetingMind to use when answering questions and reasoning.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Resource</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3 mb-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your resources by name, tags, or content..."
            className="w-full text-xs pl-9 pr-4 py-2 rounded-md border border-zinc-200 bg-white focus:outline-hidden focus:border-zinc-400"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-zinc-900 text-white shadow-2xs'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="border border-dashed border-zinc-300 rounded-xl p-14 text-center bg-white">
            <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-700 mb-1">
              {searchQuery || selectedCategory !== 'All' ? 'No matching resources found' : 'Your personal AI knowledge base is empty.'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mb-5">
              Upload PDF, DOCX, TXT, or Markdown documents to equip your personal AI assistant with persistent background knowledge.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Resource</span>
            </button>
          </div>
        ) : (
          filtered.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-300 transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/80 text-zinc-600 mt-0.5 group-hover:bg-zinc-100 transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-700">
                        {doc.title || doc.name || doc.filename}
                      </h3>
                      {renderFileIcon(doc.fileType)}
                      {doc.category && doc.category !== 'All' && (
                        <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded">
                          {doc.category}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-500 line-clamp-1 mt-1 font-sans">
                      {doc.description || doc.contentSnippet || 'Document indexed for RAG retrieval.'}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-2">
                      <span>{doc.filename}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.sizeBytes)}</span>
                      <span>•</span>
                      <span>{doc.chunkCount || 1} chunks</span>
                      <span>•</span>
                      <span>Uploaded {doc.uploadedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {doc.status === 'indexed' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Indexed
                    </span>
                  ) : doc.status === 'embedding_incomplete' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      ⚠ Embedding incomplete
                    </span>
                  ) : doc.status === 'processing' || doc.status === 'extracting' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin" />
                      Indexing...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      Failed
                    </span>
                  )}
                </div>
              </div>

              {doc.tags && doc.tags.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center gap-1.5 flex-wrap">
                  {doc.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Privacy Notice */}
      <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
          <span>Local-first storage: Your documents and vectors are stored locally on this device.</span>
        </div>
      </div>

      {/* Add Resource Modal */}
      <AddResourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdded={(newDoc) => {
          setSelectedDoc(newDoc);
        }}
        userId={userId}
      />

      {/* Resource Detail & Chunk Inspection Modal */}
      <ResourceDetailModal
        resource={selectedDoc}
        isOpen={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onAskAboutDoc={(title) => {
          onAskAboutResource?.(title);
        }}
        onDeleted={() => {
          setSelectedDoc(null);
        }}
        onUpdated={(up) => {
          setSelectedDoc(up);
        }}
      />
    </div>
  );
};
