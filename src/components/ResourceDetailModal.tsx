import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { ResourceDocument, ResourceChunk } from '../types';
import { resourceIngestion } from '../services/resourceIngestion';
import {
  X,
  FileText,
  Trash2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Tag,
  Clock,
  Database,
  Layers,
  FileCode,
} from 'lucide-react';

interface ResourceDetailModalProps {
  resource: ResourceDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onAskAboutDoc: (resourceTitle: string) => void;
  onDeleted: (resourceId: string) => void;
  onUpdated: (updated: ResourceDocument) => void;
}

export const ResourceDetailModal: React.FC<ResourceDetailModalProps> = ({
  resource,
  isOpen,
  onClose,
  onAskAboutDoc,
  onDeleted,
  onUpdated,
}) => {
  const [chunks, setChunks] = useState<ResourceChunk[]>([]);
  const [isReindexing, setIsReindexing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'chunks' | 'raw'>('overview');

  useEffect(() => {
    if (resource && isOpen) {
      db.resourceChunks
        .where('resourceId')
        .equals(resource.id)
        .sortBy('index')
        .then(setChunks);
    }
  }, [resource?.id, isOpen]);

  if (!isOpen || !resource) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const updated = await resourceIngestion.reindex(resource.id);
      if (updated) {
        onUpdated(updated);
        const freshChunks = await db.resourceChunks
          .where('resourceId')
          .equals(resource.id)
          .sortBy('index');
        setChunks(freshChunks);
      }
    } catch (err) {
      console.error('Re-indexing failed:', err);
    } finally {
      setIsReindexing(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete "${resource.filename}" from your local knowledge base?`)) {
      setIsDeleting(true);
      try {
        await resourceIngestion.deleteResource(resource.id);
        onDeleted(resource.id);
        onClose();
      } catch (err) {
        console.error('Failed to delete resource:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-2xl w-full flex flex-col h-[640px] overflow-hidden">
        {/* Top Header */}
        <div className="p-5 border-b border-zinc-100 flex items-start justify-between bg-zinc-50/60">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-zinc-900 text-white mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {resource.title || resource.name}
                </h2>
                <span className="text-[10px] font-mono uppercase bg-zinc-200/80 px-1.5 py-0.2 rounded text-zinc-700">
                  {resource.fileType}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                {resource.filename} • {formatFileSize(resource.sizeBytes)} • Uploaded {resource.uploadedAt}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-2.5 bg-zinc-50/30 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('chunks')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                activeTab === 'chunks'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              RAG Chunks ({chunks.length})
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                activeTab === 'raw'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              Raw Text
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onAskAboutDoc(resource.title || resource.name);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-200" />
              <span>Ask about document</span>
            </button>

            <button
              onClick={handleReindex}
              disabled={isReindexing}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              title="Re-index document"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-md transition-colors"
              title="Delete from knowledge base"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-5 overflow-y-auto font-sans text-xs">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Document Summary */}
              <div>
                <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-2">
                  Description
                </h3>
                <p className="text-zinc-700 leading-relaxed bg-zinc-50 p-3 rounded-lg border border-zinc-200/70">
                  {resource.description || resource.contentSnippet || 'No description provided.'}
                </p>
              </div>

              {/* RAG Knowledge Stats */}
              <div>
                <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-3">
                  AI-Retrievable Knowledge
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-zinc-900">{resource.chunkCount || chunks.length}</div>
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">Vector Chunks</div>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-zinc-900">{resource.pageCount || 1}</div>
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">Pages / Sections</div>
                  </div>
                  <div className="bg-zinc-100 border border-zinc-300 rounded-lg p-3 text-center">
                    <div className="text-xs font-semibold text-black flex items-center justify-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                      Indexed
                    </div>
                    <div className="text-[10px] text-zinc-600 font-mono mt-0.5">Local RAG Store</div>
                  </div>
                </div>
              </div>

              {/* Category & Tags */}
              <div>
                <h3 className="text-xs font-mono font-semibold uppercase text-zinc-400 tracking-wider mb-2">
                  Metadata
                </h3>
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-medium">
                    Category: {resource.category || 'All'}
                  </span>
                  {resource.tags && resource.tags.length > 0 && (
                    <>
                      {resource.tags.map((tag, i) => (
                        <span key={i} className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded font-mono">
                          #{tag}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chunks' && (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400 font-mono mb-2">
                Document is segmented into {chunks.length} semantically indexed chunks for local retrieval:
              </p>
              {chunks.map((chk) => (
                <div key={chk.id} className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 border-b border-zinc-200/60 pb-1">
                    <span className="font-semibold text-zinc-700">
                      Chunk #{chk.index + 1} {chk.heading ? `• ${chk.heading}` : ''}
                    </span>
                    <span>{chk.pageNumber ? `Page ${chk.pageNumber}` : `~${chk.tokenCount || 200} tokens`}</span>
                  </div>
                  <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap font-sans pt-1">
                    {chk.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 font-mono text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {resource.rawText || 'No raw text available.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
