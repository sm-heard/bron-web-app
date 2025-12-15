import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@/lib/db';
import { buildRunContext, saveMessage } from './context-builder';
import {
  gmailSearch,
  gmailGetMessage,
  gmailGetAttachment,
  gmailCreateDraft,
  gmailSendDraft,
  emitUI,
  emitLog,
  emitStatus,
  emitToolUse,
  spawnBron,
  awaitBron,
  toolDefinitions,
} from '@/lib/mcp-tools';

interface RunnerOptions {
  maxTurns?: number;
  maxToolCalls?: number;
  timeoutMs?: number;
}

interface RunResult {
  success: boolean;
  finalStatus: 'succeeded' | 'failed' | 'canceled' | 'needs_approval';
  error?: string;
}

const DEFAULT_OPTIONS: Required<RunnerOptions> = {
  maxTurns: 20,
  maxToolCalls: 50,
  timeoutMs: 300000, // 5 minutes
};

/**
 * Execute an agent run
 */
export async function executeRun(
  runId: string,
  options: RunnerOptions = {}
): Promise<RunResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let totalToolCalls = 0;

  try {
    // Build context
    const context = await buildRunContext(runId);
    if (!context) {
      return { success: false, finalStatus: 'failed', error: 'Run not found' };
    }

    // Update run status to running
    await emitStatus(runId, 'running');
    await sql`
      UPDATE runs SET status = 'running', started_at = NOW() WHERE id = ${runId}
    `;

    // Initialize Anthropic client
    const anthropic = new Anthropic();

    // Convert messages to Anthropic format
    let messages: Anthropic.MessageParam[] = context.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Run the agent loop
    for (let turn = 0; turn < opts.maxTurns; turn++) {
      // Check timeout
      if (Date.now() - startTime > opts.timeoutMs) {
        await emitLog(runId, 'Run timed out', 'error');
        return { success: false, finalStatus: 'failed', error: 'Timeout' };
      }

      // Call Claude
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: context.systemPrompt,
        tools: toolDefinitions as Anthropic.Tool[],
        messages,
      });

      // Process response
      const assistantContent: Anthropic.ContentBlock[] = [];
      let hasToolUse = false;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        assistantContent.push(block);

        if (block.type === 'text') {
          // Save assistant text to conversation
          await saveMessage(context.bron.id, runId, 'assistant', block.text);
          await emitLog(runId, block.text.slice(0, 200) + (block.text.length > 200 ? '...' : ''));
        } else if (block.type === 'tool_use') {
          hasToolUse = true;
          totalToolCalls++;

          if (totalToolCalls > opts.maxToolCalls) {
            await emitLog(runId, 'Maximum tool calls exceeded', 'error');
            return { success: false, finalStatus: 'failed', error: 'Max tool calls exceeded' };
          }

          // Execute tool
          await emitToolUse(runId, block.name, 'start');
          const result = await executeToolCall(runId, context.bron.id, block.name, block.input);
          await emitToolUse(runId, block.name, 'end', result);

          // Check for approval requirement
          if (result.needsApproval) {
            await emitStatus(runId, 'needs_approval');
            await sql`
              UPDATE runs SET status = 'needs_approval' WHERE id = ${runId}
            `;
            return { success: true, finalStatus: 'needs_approval' };
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Add assistant message
      messages.push({ role: 'assistant', content: assistantContent });

      // If no tool use, we're done
      if (!hasToolUse) {
        break;
      }

      // Add tool results
      messages.push({ role: 'user', content: toolResults });

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        break;
      }
    }

    // Run completed successfully
    await emitStatus(runId, 'succeeded');
    await sql`
      UPDATE runs SET status = 'succeeded', finished_at = NOW() WHERE id = ${runId}
    `;

    return { success: true, finalStatus: 'succeeded' };
  } catch (err) {
    console.error('Run execution error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    await emitLog(runId, `Error: ${errorMessage}`, 'error');
    await emitStatus(runId, 'failed');
    await sql`
      UPDATE runs
      SET status = 'failed', finished_at = NOW(), error = ${errorMessage}
      WHERE id = ${runId}
    `;

    return { success: false, finalStatus: 'failed', error: errorMessage };
  }
}

/**
 * Execute a tool call and return the result
 */
async function executeToolCall(
  runId: string,
  bronId: string,
  toolName: string,
  input: any
): Promise<any> {
  switch (toolName) {
    case 'gmail_search': {
      const result = await gmailSearch(input);
      if (result.messages.length > 0) {
        // Auto-emit search results card
        await emitUI(runId, {
          kind: 'EmailSearchResultsCard',
          payload: {
            query: input.query,
            matches: result.messages.map((m) => ({
              messageId: m.messageId,
              subject: m.subject,
              from: m.from,
              date: m.date,
              reason: 'Matched search query',
            })),
          },
        });
      }
      return result;
    }

    case 'gmail_get_message': {
      const result = await gmailGetMessage(input);
      if (result.message?.attachments && result.message.attachments.length > 0) {
        // Auto-emit attachment summary
        await emitUI(runId, {
          kind: 'AttachmentSummaryCard',
          payload: {
            messageId: result.message.id,
            attachments: result.message.attachments.map((a) => ({
              attachmentId: a.attachmentId,
              filename: a.filename,
              mimeType: a.mimeType,
              sizeBytes: a.size,
            })),
          },
        });
      }
      return result;
    }

    case 'gmail_get_attachment': {
      return await gmailGetAttachment(input);
    }

    case 'gmail_create_draft': {
      const result = await gmailCreateDraft(input);
      if (result.draft) {
        // Emit draft card for approval
        await emitUI(runId, {
          kind: 'EmailDraftCard',
          payload: {
            draftId: result.draft.id,
            to: input.to,
            cc: input.cc || [],
            subject: input.subject,
            bodyText: input.bodyText,
            requiresApproval: true,
          },
        });
        // Signal that approval is needed
        return { ...result, needsApproval: true };
      }
      return result;
    }

    case 'gmail_send_draft': {
      return await gmailSendDraft(input);
    }

    case 'emit_ui': {
      return await emitUI(runId, input);
    }

    case 'spawn_bron': {
      return await spawnBron({
        bronId: input.bronId || bronId,
        title: input.title,
        prompt: input.prompt,
        parentRunId: runId,
      });
    }

    case 'await_bron': {
      return await awaitBron(input.runId, {
        timeoutMs: input.timeoutMs,
      });
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Resume a run after approval
 */
export async function resumeRunAfterApproval(
  runId: string,
  approved: boolean,
  approvalToken?: string
): Promise<RunResult> {
  try {
    if (!approved) {
      await emitStatus(runId, 'canceled');
      await sql`
        UPDATE runs SET status = 'canceled', finished_at = NOW() WHERE id = ${runId}
      `;
      return { success: true, finalStatus: 'canceled' };
    }

    // Get the pending draft from run events
    const events = await sql`
      SELECT payload FROM run_events
      WHERE run_id = ${runId} AND type = 'ui'
      ORDER BY seq DESC
      LIMIT 10
    `;

    let draftId: string | null = null;
    for (const event of events) {
      const payload = event.payload;
      if (payload.kind === 'EmailDraftCard' && payload.payload.requiresApproval) {
        draftId = payload.payload.draftId;
        break;
      }
    }

    if (!draftId) {
      return { success: false, finalStatus: 'failed', error: 'No pending draft found' };
    }

    // Send the draft
    const result = await gmailSendDraft({
      draftId,
      approvalToken: approvalToken || crypto.randomUUID(),
    });

    if (result.error) {
      await emitLog(runId, `Failed to send: ${result.error}`, 'error');
      await emitStatus(runId, 'failed');
      return { success: false, finalStatus: 'failed', error: result.error };
    }

    // Emit success summary
    await emitUI(runId, {
      kind: 'RunSummaryCard',
      payload: {
        outcome: 'succeeded',
        highlights: ['Email sent successfully'],
        sentMessageId: result.messageId,
      },
    });

    await emitStatus(runId, 'succeeded');
    await sql`
      UPDATE runs SET status = 'succeeded', finished_at = NOW() WHERE id = ${runId}
    `;

    return { success: true, finalStatus: 'succeeded' };
  } catch (err) {
    console.error('Resume after approval error:', err);
    return {
      success: false,
      finalStatus: 'failed',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
