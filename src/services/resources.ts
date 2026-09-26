import { db } from '../db';
import { ResourceDocument, MemoryEntry } from '../types';


/**
 * Parses raw text from an uploaded file (TXT, MD, CSV, or mock text extraction for PDF/DOCX)
 */
export async function parseUploadedFile(file: File): Promise<{ text: string; fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'csv' }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'txt';
  let fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'csv' = 'txt';

  if (extension === 'pdf') fileType = 'pdf';
  else if (extension === 'docx') fileType = 'docx';
  else if (extension === 'md') fileType = 'md';
  else if (extension === 'csv') fileType = 'csv';

  // Read text directly for txt, md, csv, json
  if (fileType === 'txt' || fileType === 'md' || fileType === 'csv') {
    const text = await file.text();
    return { text, fileType };
  }

  // For PDF / DOCX in browser without heavy external WASM binaries, extract readable text streams
  try {
    const text = await file.text();
    const cleanText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanText.length > 50) {
      return { text: cleanText, fileType };
    }
  } catch (e) {}

  // Fallback readable descriptor
  return {
    text: `Document ${file.name} uploaded on ${new Date().toISOString().split('T')[0]}.\nFile size: ${(file.size / 1024).toFixed(1)} KB.`,
    fileType,
  };
}

import { resourceIngestion } from './resourceIngestion';

/**
 * Indexes a resource document into Dexie and creates searchable RAG memory entries.
 */
export async function addResourceDocument(
  file: File,
  userId = 'default_user'
): Promise<ResourceDocument> {
  return await resourceIngestion.ingest(file, { userId });
}

/**
 * Deletes a resource document and its associated memory chunks.
 */
export async function deleteResourceDocument(resourceId: string): Promise<void> {
  await resourceIngestion.deleteResource(resourceId);
}
