/**
 * Run Workflow - Orchestrates the execution of a Bron run
 *
 * This workflow handles:
 * 1. Loading context (Bron config, OAuth tokens, conversation history)
 * 2. Executing the agent with MCP tools
 * 3. Handling approval gates (pausing for user approval)
 * 4. Resuming after approval
 * 5. Cleanup and finalization
 */

import { sql } from '@/lib/db';
import { executeRun, resumeRunAfterApproval } from '@/lib/runner';
import { emitStatus, emitLog } from '@/lib/mcp-tools';
import { isGmailConnected } from '@/lib/gmail/auth';

export interface WorkflowInput {
  runId: string;
  bronId: string;
  prompt: string;
}

export interface WorkflowResult {
  success: boolean;
  status: 'succeeded' | 'failed' | 'canceled' | 'needs_approval';
  error?: string;
}

/**
 * Start a new run workflow
 */
export async function startRunWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const { runId, bronId, prompt } = input;

  try {
    // Step 1: Validate prerequisites
    const validation = await validatePrerequisites(runId, bronId);
    if (!validation.valid) {
      await markRunFailed(runId, validation.error!);
      return { success: false, status: 'failed', error: validation.error };
    }

    // Step 2: Initialize run
    await initializeRun(runId);

    // Step 3: Execute the agent
    const result = await executeRun(runId, {
      maxTurns: 20,
      maxToolCalls: 50,
      timeoutMs: 300000, // 5 minutes
    });

    return {
      success: result.success,
      status: result.finalStatus,
      error: result.error,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Workflow execution failed';
    await markRunFailed(runId, errorMessage);
    return { success: false, status: 'failed', error: errorMessage };
  }
}

/**
 * Resume a workflow after approval
 */
export async function resumeRunWorkflow(
  runId: string,
  approved: boolean
): Promise<WorkflowResult> {
  try {
    const result = await resumeRunAfterApproval(runId, approved);
    return {
      success: result.success,
      status: result.finalStatus,
      error: result.error,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Resume failed';
    await markRunFailed(runId, errorMessage);
    return { success: false, status: 'failed', error: errorMessage };
  }
}

/**
 * Validate that all prerequisites are met before starting the run
 */
async function validatePrerequisites(
  runId: string,
  bronId: string
): Promise<{ valid: boolean; error?: string }> {
  // Check Bron exists
  const brons = await sql`SELECT id FROM brons WHERE id = ${bronId}`;
  if (brons.length === 0) {
    return { valid: false, error: 'Agent not found' };
  }

  // Check run exists and is in valid state
  const runs = await sql`SELECT status FROM runs WHERE id = ${runId}`;
  if (runs.length === 0) {
    return { valid: false, error: 'Run not found' };
  }

  const status = runs[0].status;
  if (!['queued', 'needs_approval'].includes(status)) {
    return { valid: false, error: `Run is in invalid state: ${status}` };
  }

  // Check Gmail is connected (required for email operations)
  const gmailConnected = await isGmailConnected();
  if (!gmailConnected) {
    await emitLog(runId, 'Gmail not connected - email operations will fail', 'warn');
  }

  return { valid: true };
}

/**
 * Initialize run state
 */
async function initializeRun(runId: string): Promise<void> {
  await sql`
    UPDATE runs
    SET status = 'running', started_at = NOW(), updated_at = NOW()
    WHERE id = ${runId}
  `;
  await emitStatus(runId, 'running');
  await emitLog(runId, 'Run started');
}

/**
 * Mark a run as failed
 */
async function markRunFailed(runId: string, error: string): Promise<void> {
  await sql`
    UPDATE runs
    SET status = 'failed', finished_at = NOW(), error = ${error}, updated_at = NOW()
    WHERE id = ${runId}
  `;
  await emitStatus(runId, 'failed');
  await emitLog(runId, `Run failed: ${error}`, 'error');
}

/**
 * Check workflow status
 */
export async function getWorkflowStatus(runId: string): Promise<{
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
} | null> {
  const runs = await sql`
    SELECT status, started_at, finished_at, error
    FROM runs
    WHERE id = ${runId}
  `;

  if (runs.length === 0) {
    return null;
  }

  return {
    status: runs[0].status,
    startedAt: runs[0].started_at,
    finishedAt: runs[0].finished_at,
    error: runs[0].error,
  };
}

/**
 * Cancel a running workflow
 */
export async function cancelWorkflow(runId: string): Promise<boolean> {
  const runs = await sql`
    SELECT status FROM runs WHERE id = ${runId}
  `;

  if (runs.length === 0) {
    return false;
  }

  const status = runs[0].status;
  if (['succeeded', 'failed', 'canceled'].includes(status)) {
    return false; // Already in terminal state
  }

  await sql`
    UPDATE runs
    SET status = 'canceled', finished_at = NOW(), updated_at = NOW()
    WHERE id = ${runId}
  `;
  await emitStatus(runId, 'canceled');
  await emitLog(runId, 'Run canceled by user');

  return true;
}
