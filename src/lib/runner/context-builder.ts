import { sql } from '@/lib/db';
import type { Bron, Run, BronMessage } from '@/types/db';

interface RunContext {
  bron: Bron;
  run: Run;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Build the context for an agent run
 * This includes the bron's system prompt, memory summary, and conversation history
 */
export async function buildRunContext(runId: string): Promise<RunContext | null> {
  try {
    // Fetch run with bron details
    const runs = await sql`
      SELECT
        r.*,
        b.id as bron_id,
        b.name as bron_name,
        b.system_prompt as bron_system_prompt,
        b.memory_summary as bron_memory_summary,
        b.avatar_color as bron_avatar_color
      FROM runs r
      JOIN brons b ON r.bron_id = b.id
      WHERE r.id = ${runId}
    `;

    if (runs.length === 0) {
      return null;
    }

    const row = runs[0];

    const bron: Bron = {
      id: row.bron_id,
      name: row.bron_name,
      system_prompt: row.bron_system_prompt,
      memory_summary: row.bron_memory_summary,
      avatar_color: row.bron_avatar_color,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const run: Run = {
      id: row.id,
      bron_id: row.bron_id,
      title: row.title,
      prompt: row.prompt,
      status: row.status,
      parent_run_id: row.parent_run_id,
      approval_token_hash: row.approval_token_hash || null,
      started_at: row.started_at,
      finished_at: row.finished_at,
      error: row.error,
      created_at: row.created_at,
    };

    // Build system prompt
    const systemPrompt = buildSystemPrompt(bron);

    // Fetch recent conversation history (last 20 messages for context)
    const recentMessages = await sql`
      SELECT role, content
      FROM bron_messages
      WHERE bron_id = ${bron.id}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // Reverse to get chronological order
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> =
      recentMessages.reverse().map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Add current task as user message
    messages.push({
      role: 'user',
      content: run.prompt,
    });

    return { bron, run, systemPrompt, messages };
  } catch (err) {
    console.error('Failed to build run context:', err);
    return null;
  }
}

/**
 * Build the system prompt for the agent
 */
function buildSystemPrompt(bron: Bron): string {
  const parts: string[] = [];

  // Base identity
  parts.push(`You are ${bron.name}, an AI assistant that helps with email-related tasks.`);

  // Capabilities
  parts.push(`
You have access to the following capabilities:
- Search Gmail for messages matching specific criteria
- Read email content and attachments
- Extract information from PDF and document attachments
- Draft and send emails (with user approval)
- Display results and extracted data in structured UI cards

When working on tasks:
1. Break down complex tasks into clear steps
2. Show your work by emitting UI cards with results
3. Always ask for approval before sending any emails
4. If you encounter errors, report them clearly and suggest alternatives
`);

  // Custom system prompt
  if (bron.system_prompt) {
    parts.push(`\nAdditional Instructions:\n${bron.system_prompt}`);
  }

  // Memory summary (learned context)
  if (bron.memory_summary) {
    parts.push(`\nContext from previous interactions:\n${bron.memory_summary}`);
  }

  // Tool usage guidelines
  parts.push(`
Tool Usage Guidelines:
- Use gmail_search to find relevant emails
- Use gmail_get_message to read full email content
- Use gmail_get_attachment to download attachments for analysis
- Use emit_ui to display results to the user:
  - EmailSearchResultsCard: Show search results with match reasons
  - AttachmentSummaryCard: List attachments found in an email
  - ExtractedFieldsTable: Display extracted data with confidence scores
  - EmailDraftCard: Show a draft email for review (requires approval)
  - RunSummaryCard: Show final outcome with highlights
- Use gmail_create_draft to prepare emails (they require user approval to send)
`);

  return parts.join('\n');
}

/**
 * Save a message to the bron's conversation history
 */
export async function saveMessage(
  bronId: string,
  runId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  try {
    await sql`
      INSERT INTO bron_messages (bron_id, run_id, role, content)
      VALUES (${bronId}, ${runId}, ${role}, ${content})
    `;
  } catch (err) {
    console.error('Failed to save message:', err);
  }
}

/**
 * Update bron's memory summary after a run
 */
export async function updateMemorySummary(
  bronId: string,
  summary: string
): Promise<void> {
  try {
    await sql`
      UPDATE brons
      SET memory_summary = ${summary}, updated_at = NOW()
      WHERE id = ${bronId}
    `;
  } catch (err) {
    console.error('Failed to update memory summary:', err);
  }
}

/**
 * Get the transcript of a run (all events)
 */
export async function getRunTranscript(runId: string): Promise<{
  events: Array<{ type: string; payload: any; createdAt: string }>;
}> {
  try {
    const events = await sql`
      SELECT type, payload, created_at
      FROM run_events
      WHERE run_id = ${runId}
      ORDER BY seq ASC
    `;

    return {
      events: events.map((e: any) => ({
        type: e.type,
        payload: e.payload,
        createdAt: e.created_at,
      })),
    };
  } catch (err) {
    console.error('Failed to get run transcript:', err);
    return { events: [] };
  }
}
