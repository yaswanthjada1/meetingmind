import React, { useState, useRef } from 'react';
import { db } from '../db';
import { ResourceCategory, ResourceDocument } from '../types';
import { resourceIngestion } from '../services/resourceIngestion';
import {
  X,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Tag,
  Folder,
  File,
} from 'lucide-react';

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (resource: ResourceDocument) => void;
  userId?: string;
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

export const AddResourceModal: React.FC<AddResourceModalProps> = ({
  isOpen,
  onClose,
  onAdded,
  userId = 'default_user',
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ResourceCategory>('Projects');
  const [tagsInput, setTagsInput] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<ResourceDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await processSelectedFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await processSelectedFile(file);
  };

  const processSelectedFile = async (file: File) => {
    setErrorMessage(null);
    setDuplicateWarning(null);

    // Check supported extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    const supported = ['pdf', 'docx', 'txt', 'md', 'markdown', 'csv', 'pptx'];
    if (!ext || !supported.includes(ext)) {
      setErrorMessage(`File type ".${ext}" is not supported yet. Supported types: PDF, DOCX, TXT, MD, CSV.`);
      return;
    }

    // Check duplicates in IndexedDB
    const existing = await db.resources
      .where('userId')
      .equals(userId)
      .and((r) => r.filename === file.name && r.sizeBytes === file.size)
      .first();

    if (existing) {
      setDuplicateWarning(existing);
    }

    setSelectedFile(file);
    if (!name) {
      setName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please choose or drop a document to index.');
      return;
    }

    setIsIngesting(true);
    setErrorMessage(null);

    try {
      const tags = tagsInput
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const doc = await resourceIngestion.ingest(selectedFile, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        category,
        tags,
        userId,
      });

      onAdded(doc);
      onClose();
    } catch (err: any) {
      console.error('Failed to ingest document:', err);
      setErrorMessage(err?.message || 'Failed to ingest and index document.');
    } finally {
      setIsIngesting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/60">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Add to Knowledge Base</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Upload documents MeetingMind will use when answering questions and reasoning.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* File Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              selectedFile
                ? 'border-zinc-400 bg-zinc-50/70'
                : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,.md,.markdown,.csv,.pptx"
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-2.5 rounded-lg bg-zinc-900 text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-zinc-900 truncate max-w-[280px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    {formatFileSize(selectedFile.size)} • {selectedFile.name.split('.').pop()?.toUpperCase()}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-800">
                  Drop files here or <span className="text-zinc-900 underline font-semibold">browse</span>
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                  PDF · DOCX · TXT · MD · CSV
                </p>
              </div>
            )}
          </div>

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div className="p-2.5 bg-zinc-100 border border-black rounded-md flex items-start gap-2 text-xs text-black">
              <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Duplicate document detected:</span> A file named{' '}
                <span className="font-mono">{duplicateWarning.filename}</span> is already indexed. Submitting will update/re-index it.
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 bg-zinc-100 border border-black rounded-md text-xs text-black">
              {errorMessage}
            </div>
          )}

          {/* Document Title / Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Resource Name <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Alpha Architecture or Company Policy"
              className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-500 bg-white"
            />
          </div>

          {/* Category & Tags Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Tags <span className="text-zinc-400 font-normal">(Comma separated)</span>
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="architecture, auth, backend"
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Description <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what this document covers..."
              className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-500 bg-white"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Stored locally on your device</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isIngesting || !selectedFile}
                className="px-4 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-all shadow-2xs disabled:opacity-50"
              >
                {isIngesting ? 'Indexing...' : 'Add to Knowledge Base'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
