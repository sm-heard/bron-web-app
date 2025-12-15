// Database types based on PRD schema

export type BronStatus = 'idle' | 'running' | 'needs_approval' | 'completed' | 'failed';

export type RunStatus =
  | 'queued'
  | 'running'
  | 'needs_approval'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type RunEventType =
  | 'status'
  | 'message'
  | 'log'
  | 'tool'
  | 'ui'
  | 'artifact'
  | 'child_run';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type OAuthProvider = 'google';

// Table types

export interface Bron {
  id: string;
  name: string;
  avatar_color: string;
  system_prompt: string;
  memory_summary: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Run {
  id: string;
  bron_id: string;
  parent_run_id: string | null;
  title: string;
  prompt: string;
  status: RunStatus;
  approval_token_hash: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  error: RunError | null;
}

export interface RunError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface RunEvent {
  id: number;
  run_id: string;
  seq: number;
  type: RunEventType;
  payload: RunEventPayload;
  created_at: Date;
}

// Run event payloads
export type RunEventPayload =
  | StatusEventPayload
  | LogEventPayload
  | MessageEventPayload
  | ToolEventPayload
  | UIEventPayload
  | ArtifactEventPayload
  | ChildRunEventPayload;

export interface StatusEventPayload {
  status: RunStatus;
}

export interface LogEventPayload {
  message: string;
  level?: 'info' | 'warn' | 'error';
}

export interface MessageEventPayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolEventPayload {
  name: string;
  phase: 'start' | 'end';
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
}

export interface UIEventPayload {
  kind: UICardKind;
  payload: UICardPayload;
}

export interface ArtifactEventPayload {
  kind: string;
  blob_url?: string;
  data?: Record<string, unknown>;
}

export interface ChildRunEventPayload {
  child_run_id: string;
  title: string;
  status: RunStatus;
}

// UI Card types
export type UICardKind =
  | 'EmailSearchResultsCard'
  | 'AttachmentSummaryCard'
  | 'ExtractedFieldsTable'
  | 'EmailDraftCard'
  | 'RunSummaryCard';

export type UICardPayload =
  | EmailSearchResultsPayload
  | AttachmentSummaryPayload
  | ExtractedFieldsPayload
  | EmailDraftPayload
  | RunSummaryPayload;

export interface EmailSearchResultsPayload {
  query: string;
  matches: Array<{
    messageId: string;
    from: string;
    subject: string;
    date: string;
    reason: string;
  }>;
}

export interface AttachmentSummaryPayload {
  messageId: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    attachmentId: string;
  }>;
}

export interface ExtractedFieldsPayload {
  source: string;
  fields: Array<{
    key: string;
    value: string;
    confidence?: number;
  }>;
}

export interface EmailDraftPayload {
  to: string;
  cc: string[];
  subject: string;
  bodyText: string;
  draftId: string;
  requiresApproval: boolean;
}

export interface RunSummaryPayload {
  outcome: 'succeeded' | 'failed' | 'canceled';
  highlights: string[];
  sentMessageId?: string;
}

// Other tables

export interface BronMessage {
  id: number;
  bron_id: string;
  run_id: string | null;
  role: MessageRole;
  content: string;
  created_at: Date;
}

export interface Upload {
  id: string;
  run_id: string;
  filename: string;
  content_type: string;
  blob_url: string;
  size_bytes: number;
  created_at: Date;
}

export interface Artifact {
  id: string;
  run_id: string;
  kind: string;
  blob_url: string | null;
  data: Record<string, unknown> | null;
  created_at: Date;
}

export interface OAuthToken {
  id: string;
  provider: OAuthProvider;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expiry: Date;
  scopes: string[];
  created_at: Date;
  updated_at: Date;
}

// API types (for request/response)

export interface CreateBronRequest {
  name: string;
  avatar_color?: string;
  system_prompt?: string;
}

export interface UpdateBronRequest {
  name?: string;
  avatar_color?: string;
  system_prompt?: string;
  memory_summary?: string;
}

export interface CreateRunRequest {
  bron_id: string;
  title?: string;
  prompt: string;
  upload_ids?: string[];
}

export interface ApproveRunRequest {
  approved: boolean;
}

// Computed/joined types for API responses

export interface BronWithLatestRun extends Bron {
  latest_run?: Pick<Run, 'id' | 'title' | 'status' | 'created_at'> | null;
}
