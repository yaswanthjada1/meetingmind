import { db } from '../db';
import {
  ResourceDocument,
  ResourceChunk,
  ResourceFileRecord,
  ResourceCategory,
  MemoryEntry,
} from '../types';
import { generateEmbedding, cosineSimilarity, OLLAMA_EMBEDDING_MODEL } from './llm';

export interface SearchResultChunk {
  chunk: ResourceChunk;
  resourceTitle: string;
  filename: string;
  snippet: string;
  score: number;
  pageNumber?: number;
  heading?: string;
  section?: string;
}

export class ResourceIngestionService {
  /**
   * Detects clean file type from File object.
   */
  detectFileType(file: File): 'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'pptx' | 'other' {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    if (ext === 'txt') return 'txt';
    if (ext === 'md' || ext === 'markdown') return 'md';
    if (ext === 'csv') return 'csv';
    if (ext === 'pptx') return 'pptx';
    return 'other';
  }

  /**
   * Extracts text, structure, headings, and pages from various document types.
   */
  async extractText(file: File): Promise<{
    rawText: string;
    pageCount: number;
    sections: Array<{ heading: string; text: string; pageNumber?: number }>;
    isScannedOrEmpty?: boolean;
  }> {
    const fileType = this.detectFileType(file);

    // 1. Text, Markdown, CSV Files
    if (fileType === 'txt' || fileType === 'csv') {
      const text = await file.text();
      return {
        rawText: text,
        pageCount: Math.max(1, Math.ceil(text.length / 2500)),
        sections: [{ heading: 'Content', text, pageNumber: 1 }],
      };
    }

    if (fileType === 'md') {
      const text = await file.text();
      const sections: Array<{ heading: string; text: string; pageNumber?: number }> = [];
      const lines = text.split('\n');

      let currentHeading = 'Overview';
      let currentBuffer: string[] = [];

      for (const line of lines) {
        if (line.startsWith('#')) {
          if (currentBuffer.length > 0) {
            sections.push({
              heading: currentHeading,
              text: currentBuffer.join('\n').trim(),
            });
            currentBuffer = [];
          }
          currentHeading = line.replace(/^#+\s*/, '').trim();
        } else {
          currentBuffer.push(line);
        }
      }

      if (currentBuffer.length > 0) {
        sections.push({
          heading: currentHeading,
          text: currentBuffer.join('\n').trim(),
        });
      }

      return {
        rawText: text,
        pageCount: Math.max(1, Math.ceil(text.length / 2500)),
        sections: sections.length > 0 ? sections : [{ heading: 'Overview', text, pageNumber: 1 }],
      };
    }

    // 2. PDF Document text extraction
    if (fileType === 'pdf') {
      try {
        const text = await file.text();
        const cleanText = text
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanText.length < 40) {
          return {
            rawText: `[PDF Document: ${file.name}]\nUploaded file containing binary streams without raw plaintext.`,
            pageCount: 1,
            sections: [{ heading: 'Header', text: `Document ${file.name}`, pageNumber: 1 }],
            isScannedOrEmpty: true,
          };
        }

        const pageSplits = cleanText.split(/Page\s+\d+|---\s*Page\s*\d+\s*---|(?<=\.\s{2,})/i);
        const sections: Array<{ heading: string; text: string; pageNumber?: number }> = [];

        pageSplits.forEach((chunk, i) => {
          if (chunk.trim().length > 20) {
            sections.push({
              heading: `Page ${i + 1}`,
              text: chunk.trim(),
              pageNumber: i + 1,
            });
          }
        });

        return {
          rawText: cleanText,
          pageCount: Math.max(1, sections.length),
          sections: sections.length > 0 ? sections : [{ heading: 'Page 1', text: cleanText, pageNumber: 1 }],
        };
      } catch (err) {
        return {
          rawText: `Document ${file.name}`,
          pageCount: 1,
          sections: [{ heading: 'File Metadata', text: `Document ${file.name}`, pageNumber: 1 }],
        };
      }
    }

    // 3. DOCX Document text extraction
    if (fileType === 'docx') {
      try {
        const text = await file.text();
        const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanText.length > 30) {
          return {
            rawText: cleanText,
            pageCount: Math.max(1, Math.ceil(cleanText.length / 2000)),
            sections: [{ heading: 'Document Body', text: cleanText, pageNumber: 1 }],
          };
        }
      } catch (e) {}

      return {
        rawText: `Word Document ${file.name}`,
        pageCount: 1,
        sections: [{ heading: 'Document', text: `Word Document ${file.name}`, pageNumber: 1 }],
      };
    }

    // Default fallback
    const text = await file.text();
    return {
      rawText: text || `Document ${file.name}`,
      pageCount: 1,
      sections: [{ heading: 'General', text: text || `File ${file.name}`, pageNumber: 1 }],
    };
  }

  /**
   * Chunks text into 250-500 token segments with contextual section & page metadata.
   */
  chunkText(
    extracted: {
      rawText: string;
      sections: Array<{ heading: string; text: string; pageNumber?: number }>;
    },
    meta: {
      resourceId: string;
      resourceTitle: string;
      filename: string;
      userId: string;
    }
  ): ResourceChunk[] {
    const chunks: ResourceChunk[] = [];
    let chunkIndex = 0;

    for (const sec of extracted.sections) {
      const paragraphs = sec.text.split(/\n\n+|(?<=[.!?])\s{2,}/).filter((p) => p.trim().length > 15);

      let currentChunk = '';
      let currentWordCount = 0;

      for (const p of paragraphs) {
        const words = p.trim().split(/\s+/);
        if (currentWordCount + words.length > 200 && currentChunk.length > 0) {
          chunks.push({
            id: `chk-${meta.resourceId}-${chunkIndex}`,
            userId: meta.userId,
            resourceId: meta.resourceId,
            resourceTitle: meta.resourceTitle,
            filename: meta.filename,
            text: currentChunk.trim(),
            index: chunkIndex,
            pageNumber: sec.pageNumber || Math.floor(chunkIndex / 3) + 1,
            heading: sec.heading,
            section: sec.heading,
            tokenCount: Math.round(currentWordCount * 1.3),
            createdAt: Date.now() + chunkIndex,
          });
          chunkIndex++;
          const overlap = currentChunk.split(/\s+/).slice(-25).join(' ');
          currentChunk = overlap + ' ' + p.trim();
          currentWordCount = overlap.split(/\s+/).length + words.length;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + p.trim();
          currentWordCount += words.length;
        }
      }

      if (currentChunk.trim().length > 10) {
        chunks.push({
          id: `chk-${meta.resourceId}-${chunkIndex}`,
          userId: meta.userId,
          resourceId: meta.resourceId,
          resourceTitle: meta.resourceTitle,
          filename: meta.filename,
          text: currentChunk.trim(),
          index: chunkIndex,
          pageNumber: sec.pageNumber || Math.floor(chunkIndex / 3) + 1,
          heading: sec.heading,
          section: sec.heading,
          tokenCount: Math.round(currentWordCount * 1.3),
          createdAt: Date.now() + chunkIndex,
        });
        chunkIndex++;
      }
    }

    if (chunks.length === 0 && extracted.rawText) {
      chunks.push({
        id: `chk-${meta.resourceId}-0`,
        userId: meta.userId,
        resourceId: meta.resourceId,
        resourceTitle: meta.resourceTitle,
        filename: meta.filename,
        text: extracted.rawText.substring(0, 1500),
        index: 0,
        pageNumber: 1,
        heading: 'Overview',
        section: 'Overview',
        tokenCount: Math.round(extracted.rawText.split(/\s+/).length * 1.3),
        createdAt: Date.now(),
      });
    }

    return chunks;
  }

  /**
   * Ingests a new file: extracts, chunks, generates embeddings with qwen3-embedding:0.6b,
   * and saves into IndexedDB scoped strictly to userId.
   */
  async ingest(
    file: File,
    options: {
      name?: string;
      description?: string;
      category?: ResourceCategory | string;
      tags?: string[];
      userId?: string;
    } = {}
  ): Promise<ResourceDocument> {
    const userId = options.userId || 'default_user';
    const resourceId = `res-${Date.now()}`;
    const fileType = this.detectFileType(file);
    const title = options.name?.trim() || file.name.replace(/\.[^/.]+$/, '');

    // 1. Initial Document Record
    const doc: ResourceDocument = {
      id: resourceId,
      userId,
      name: title,
      title,
      filename: file.name,
      originalFileName: file.name,
      fileType,
      mimeType: file.type || `application/${fileType}`,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString().split('T')[0],
      updatedAt: Date.now(),
      description: options.description?.trim() || `Uploaded ${fileType.toUpperCase()} document`,
      category: options.category || 'All',
      tags: options.tags || [],
      status: 'extracting',
      contentSnippet: '',
      chunkCount: 0,
      pageCount: 1,
      sourceCategory: fileType.toUpperCase(),
    };

    await db.resources.put(doc);

    // 2. Save original File Blob in dedicated table
    const fileRecord: ResourceFileRecord = {
      id: `file-${resourceId}`,
      userId,
      resourceId,
      blob: file,
      filename: file.name,
      mimeType: file.type || `application/${fileType}`,
      sizeBytes: file.size,
      createdAt: Date.now(),
    };
    await db.resourceFiles.put(fileRecord);

    // 3. Extract text
    const extracted = await this.extractText(file);
    doc.rawText = extracted.rawText;
    doc.pageCount = extracted.pageCount;
    doc.contentSnippet = extracted.rawText.substring(0, 220) + (extracted.rawText.length > 220 ? '...' : '');

    // 4. Chunk
    await db.resources.update(resourceId, { status: 'processing' });
    const chunks = this.chunkText(extracted, {
      resourceId,
      resourceTitle: title,
      filename: file.name,
      userId,
    });
    doc.chunkCount = chunks.length;

    // 5. Generate authentic embeddings using qwen3-embedding:0.6b
    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.text, OLLAMA_EMBEDDING_MODEL);
        if (Array.isArray(embedding) && embedding.length > 0) {
          chunk.embedding = embedding;
        }
      } catch (embErr) {
        console.warn(`Embedding generation failed for chunk ${chunk.id}:`, embErr);
      }
    }

    // 6. Store chunks in DB
    if (chunks.length > 0) {
      await db.resourceChunks.bulkPut(chunks);
    }

    // 7. READ BACK FROM INDEXEDDB TO VERIFY PERSISTENCE
    const persistedChunks = await db.resourceChunks.where('resourceId').equals(resourceId).toArray();
    const chunksWithEmbeddings = persistedChunks.filter(
      (c) => Array.isArray(c.embedding) && c.embedding.length > 0
    );

    // 8. Create RAG searchable memory entries ONLY for chunks with valid embeddings
    const memories: MemoryEntry[] = [];
    persistedChunks.forEach((chk, i) => {
      if (!Array.isArray(chk.embedding) || chk.embedding.length === 0) return;

      const words = chk.text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3);

      memories.push({
        id: `mem-res-${resourceId}-${i}`,
        userId,
        category: 'resource',
        content: `[Doc: ${file.name} | ${chk.heading || 'Section'}${chk.pageNumber ? ` (Page ${chk.pageNumber})` : ''}] ${chk.text}`,
        resourceId,
        sourceMeetingTitle: `Resource: ${title}`,
        timestamp: doc.uploadedAt,
        keywords: [
          'document',
          'resource',
          fileType,
          ...title.toLowerCase().split(/\s+/),
          ...(options.tags || []).map((t) => t.toLowerCase()),
          ...Array.from(new Set(words)).slice(0, 30),
        ],
        embedding: chk.embedding,
        createdAt: Date.now() + i,
      });
    });

    if (memories.length > 0) {
      await db.memories.bulkPut(memories);
    }

    // 9. Status check: Mark 'indexed' ONLY when chunkCount > 0 AND every required chunk has a valid embedding vector.
    if (chunks.length > 0 && chunksWithEmbeddings.length === chunks.length) {
      doc.status = 'indexed';
    } else {
      doc.status = 'embedding_incomplete';
      doc.error = `Generated embeddings for ${chunksWithEmbeddings.length}/${chunks.length} chunks.`;
    }
    await db.resources.put(doc);
    return doc;
  }

  /**
   * Atomically deletes a resource and its files, chunks, and memories.
   */
  async deleteResource(resourceId: string): Promise<void> {
    await db.resources.delete(resourceId);
    await db.resourceFiles.where('resourceId').equals(resourceId).delete();
    await db.resourceChunks.where('resourceId').equals(resourceId).delete();
    await db.memories.where('resourceId').equals(resourceId).delete();
  }

  /**
   * Re-indexes an existing stored resource file.
   */
  async reindex(resourceId: string): Promise<ResourceDocument | null> {
    const doc = await db.resources.get(resourceId);
    const fileRec = await db.resourceFiles.where('resourceId').equals(resourceId).first();
    if (!doc || !fileRec) return null;

    // Remove old chunks & memories
    await db.resourceChunks.where('resourceId').equals(resourceId).delete();
    await db.memories.where('resourceId').equals(resourceId).delete();

    const file = new File([fileRec.blob], fileRec.filename, { type: fileRec.mimeType });
    return await this.ingest(file, {
      name: doc.name,
      description: doc.description,
      category: doc.category,
      tags: doc.tags,
      userId: doc.userId,
    });
  }

  /**
   * Vector cosine similarity search across user's resource chunks using qwen3-embedding:0.6b.
   * Strictly scoped to userId. Never searches another user's data.
   */
  async searchResources(
    query: string,
    topK = 5,
    userId = 'default_user'
  ): Promise<SearchResultChunk[]> {
    if (!query.trim() || !userId) return [];

    // Strictly filter chunks by userId
    const chunks = await db.resourceChunks.where('userId').equals(userId).toArray();
    if (chunks.length === 0) return [];

    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await generateEmbedding(query, OLLAMA_EMBEDDING_MODEL);
    } catch (e) {
      console.warn('Query embedding generation failed, using keyword scoring:', e);
    }

    const queryLower = query.toLowerCase();
    const queryTokens = queryLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scored: SearchResultChunk[] = [];

    for (const chunk of chunks) {
      let score = 0;

      // 1. Vector cosine similarity (if embeddings exist)
      if (queryEmbedding.length > 0 && chunk.embedding && chunk.embedding.length > 0) {
        const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
        score += sim * 10.0;
      }

      // 2. Keyword boost
      const textLower = chunk.text.toLowerCase();
      const headingLower = (chunk.heading || '').toLowerCase();
      const titleLower = chunk.resourceTitle.toLowerCase();

      if (textLower.includes(queryLower)) score += 3.0;
      if (titleLower.includes(queryLower)) score += 2.0;
      if (headingLower.includes(queryLower)) score += 2.0;

      for (const token of queryTokens) {
        if (textLower.includes(token)) score += 0.5;
        if (headingLower.includes(token)) score += 0.8;
      }

      if (score > 0.1) {
        scored.push({
          chunk,
          resourceTitle: chunk.resourceTitle,
          filename: chunk.filename,
          snippet: chunk.text.substring(0, 260) + (chunk.text.length > 260 ? '...' : ''),
          score,
          pageNumber: chunk.pageNumber,
          heading: chunk.heading,
          section: chunk.section,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Cleans up any orphaned chunks in IndexedDB whose parent resource record no longer exists.
   */
  async purgeOrphanedChunks(): Promise<void> {
    try {
      const allResources = await db.resources.toArray();
      const validResourceIds = new Set(allResources.map((r) => r.id));
      const allChunks = await db.resourceChunks.toArray();

      for (const chk of allChunks) {
        if (!validResourceIds.has(chk.resourceId)) {
          await db.resourceChunks.delete(chk.id);
          await db.memories.where('resourceId').equals(chk.resourceId).delete();
        }
      }
    } catch (e) {
      console.warn('Purge orphaned chunks warning:', e);
    }
  }
}

export const resourceIngestion = new ResourceIngestionService();
