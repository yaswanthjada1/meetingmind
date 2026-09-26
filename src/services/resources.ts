import { db } from '../db';
import { ResourceDocument, MemoryEntry } from '../types';

export const DEMO_RESOURCES: ResourceDocument[] = [
  {
    id: 'res-arch-pdf',
    userId: 'default_user',
    name: 'Project Alpha Architecture Specification',
    title: 'Project Alpha Architecture Specification',
    filename: 'Architecture.pdf',
    originalFileName: 'Architecture.pdf',
    fileType: 'pdf',
    sizeBytes: 2400000,
    uploadedAt: '2026-09-24',
    category: 'Technical',
    tags: ['architecture', 'postgresql', 'jwt', 'backend'],
    status: 'indexed',
    chunkCount: 8,
    pageCount: 3,
    sourceCategory: 'Architecture',
    description: 'Microservices architecture with stateless JWT authentication, PostgreSQL primary storage, and local-first offline caching.',
    contentSnippet: 'Microservices architecture with stateless JWT authentication, PostgreSQL primary storage, and local-first offline caching.',
    rawText: `Project Alpha Architecture Specification
Version 2.4 - Approved by Yaswanth

1. Storage Tier:
PostgreSQL is chosen as the primary transactional database due to ACID guarantees, complex relational integrity for billing, and native JSONB document support for flexible metadata. NoSQL/MongoDB was rejected due to lack of multi-table transaction guarantees.

2. Authentication:
Stateless JSON Web Tokens (JWT) with 15-minute access token lifespan and encrypted HttpOnly refresh tokens. Middleware validates HMAC SHA-256 signatures at API gateway.

3. Deployment & Scalability:
Target environment containerized with Docker. API deployment scheduled for Friday with end-to-end regression validation.`,
  },
  {
    id: 'res-api-spec-pdf',
    userId: 'default_user',
    name: 'API Specification & Rate Limiting Guidelines',
    title: 'API Specification & Rate Limiting Guidelines',
    filename: 'API Specification.pdf',
    originalFileName: 'API Specification.pdf',
    fileType: 'pdf',
    sizeBytes: 1800000,
    uploadedAt: '2026-09-25',
    category: 'Technical',
    tags: ['api', 'rate-limit', 'security'],
    status: 'indexed',
    chunkCount: 5,
    pageCount: 2,
    sourceCategory: 'API & Security',
    description: 'Rate limiting thresholds (100 req/min/IP), standard error JSON schemas, and token refresh endpoints.',
    contentSnippet: 'Rate limiting thresholds (100 req/min/IP), standard error JSON schemas, and token refresh endpoints.',
    rawText: `API Specification & Security Guidelines

Public Endpoints:
- Max 100 requests per minute per IP address. Exceeding requests return HTTP 429 Too Many Requests with Retry-After header.
- Token refresh endpoint (/api/v1/auth/refresh) requires active refresh token cookie and validates token rotation sequence.
- All timestamps returned in ISO 8601 UTC format.`,
  },
  {
    id: 'res-team-guide-md',
    userId: 'default_user',
    name: 'Engineering Team Guidelines & Milestone Policies',
    title: 'Engineering Team Guidelines & Milestone Policies',
    filename: 'Team Guidelines.md',
    originalFileName: 'Team Guidelines.md',
    fileType: 'md',
    sizeBytes: 45000,
    uploadedAt: '2026-09-22',
    category: 'Work',
    tags: ['policy', 'milestones', 'guidelines'],
    status: 'indexed',
    chunkCount: 3,
    pageCount: 1,
    sourceCategory: 'Policy',
    description: 'Friday milestone release rules, code review turnaround times, and delegate permission guidelines.',
    contentSnippet: 'Friday milestone release rules, code review turnaround times, and delegate permission guidelines.',
    rawText: `Team Engineering Guidelines

Milestone Commitments:
- Production deployment deadlines require explicit sign-off from Yaswanth. Deadline extensions (e.g. postponing from Friday to Monday) cannot be self-approved and must be escalated to the engineering lead.
- Every architectural decision must be documented with rationale, alternatives considered, and participating engineers.`,
  },
];

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
