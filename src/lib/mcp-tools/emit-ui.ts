import { sql } from '@/lib/db';
import type {
  UICardKind,
  EmailSearchResultsPayload,
  AttachmentSummaryPayload,
  ExtractedFieldsPayload,
  EmailDraftPayload,
  RunSummaryPayload,
} from '@/types/db';

type UIPayload =
  | { kind: 'EmailSearchResultsCard'; payload: EmailSearchResultsPayload }
  | { kind: 'AttachmentSummaryCard'; payload: AttachmentSummaryPayload }
  | { kind: 'ExtractedFieldsTable'; payload: ExtractedFieldsPayload }
  | { kind: 'EmailDraftCard'; payload: EmailDraftPayload }
  | { kind: 'RunSummaryCard'; payload: RunSummaryPayload };

/**
 * Emit a UI event to be rendered in the frontend
 * This creates a run_event of type 'ui' that the SSE stream picks up
 */
export async function emitUI(
  runId: string,
  params: UIPayload
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    // Get the next sequence number for this run
    const seqResult = await sql`
      SELECT COALESCE(MAX(seq), 0) + 1 as next_seq
      FROM run_events
      WHERE run_id = ${runId}
    `;
    const nextSeq = seqResult[0]?.next_seq || 1;

    // Insert the UI event
    const result = await sql`
      INSERT INTO run_events (run_id, type, payload, seq)
      VALUES (
        ${runId},
        'ui',
        ${JSON.stringify({ kind: params.kind, payload: params.payload })},
        ${nextSeq}
      )
      RETURNING id
    `;

    return { success: true, eventId: result[0]?.id };
  } catch (err) {
    console.error('Failed to emit UI event:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to emit UI event',
    };
  }
}

/**
 * Emit email search results card
 */
export async function emitEmailSearchResults(
  runId: string,
  query: string,
  matches: EmailSearchResultsPayload['matches']
): Promise<{ success: boolean; error?: string }> {
  return emitUI(runId, {
    kind: 'EmailSearchResultsCard',
    payload: { query, matches },
  });
}

/**
 * Emit attachment summary card
 */
export async function emitAttachmentSummary(
  runId: string,
  messageId: string,
  attachments: AttachmentSummaryPayload['attachments']
): Promise<{ success: boolean; error?: string }> {
  return emitUI(runId, {
    kind: 'AttachmentSummaryCard',
    payload: { messageId, attachments },
  });
}

/**
 * Emit extracted fields table
 */
export async function emitExtractedFields(
  runId: string,
  source: string,
  fields: ExtractedFieldsPayload['fields']
): Promise<{ success: boolean; error?: string }> {
  return emitUI(runId, {
    kind: 'ExtractedFieldsTable',
    payload: { source, fields },
  });
}

/**
 * Emit email draft card (with approval requirement)
 */
export async function emitEmailDraft(
  runId: string,
  draft: Omit<EmailDraftPayload, 'requiresApproval'> & { requiresApproval?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return emitUI(runId, {
    kind: 'EmailDraftCard',
    payload: {
      ...draft,
      requiresApproval: draft.requiresApproval ?? true, // Default to requiring approval
    },
  });
}

/**
 * Emit run summary card
 */
export async function emitRunSummary(
  runId: string,
  outcome: 'succeeded' | 'failed' | 'canceled',
  highlights: string[],
  sentMessageId?: string
): Promise<{ success: boolean; error?: string }> {
  return emitUI(runId, {
    kind: 'RunSummaryCard',
    payload: { outcome, highlights, sentMessageId },
  });
}

/**
 * Emit a log message
 */
export async function emitLog(
  runId: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): Promise<{ success: boolean; error?: string }> {
  try {
    const seqResult = await sql`
      SELECT COALESCE(MAX(seq), 0) + 1 as next_seq
      FROM run_events
      WHERE run_id = ${runId}
    `;
    const nextSeq = seqResult[0]?.next_seq || 1;

    await sql`
      INSERT INTO run_events (run_id, type, payload, seq)
      VALUES (
        ${runId},
        'log',
        ${JSON.stringify({ message, level })},
        ${nextSeq}
      )
    `;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to emit log',
    };
  }
}

/**
 * Emit a status change event
 */
export async function emitStatus(
  runId: string,
  status: 'queued' | 'running' | 'needs_approval' | 'succeeded' | 'failed' | 'canceled'
): Promise<{ success: boolean; error?: string }> {
  try {
    const seqResult = await sql`
      SELECT COALESCE(MAX(seq), 0) + 1 as next_seq
      FROM run_events
      WHERE run_id = ${runId}
    `;
    const nextSeq = seqResult[0]?.next_seq || 1;

    await sql`
      INSERT INTO run_events (run_id, type, payload, seq)
      VALUES (
        ${runId},
        'status',
        ${JSON.stringify({ status })},
        ${nextSeq}
      )
    `;

    // Also update the run status
    await sql`
      UPDATE runs SET status = ${status}, updated_at = NOW()
      WHERE id = ${runId}
    `;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to emit status',
    };
  }
}

/**
 * Emit a tool execution event
 */
export async function emitToolUse(
  runId: string,
  toolName: string,
  phase: 'start' | 'end',
  result?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const seqResult = await sql`
      SELECT COALESCE(MAX(seq), 0) + 1 as next_seq
      FROM run_events
      WHERE run_id = ${runId}
    `;
    const nextSeq = seqResult[0]?.next_seq || 1;

    await sql`
      INSERT INTO run_events (run_id, type, payload, seq)
      VALUES (
        ${runId},
        'tool',
        ${JSON.stringify({ name: toolName, phase, result })},
        ${nextSeq}
      )
    `;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to emit tool use',
    };
  }
}
