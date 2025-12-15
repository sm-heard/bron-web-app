import { sql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface SpawnBronParams {
  bronId: string;
  title: string;
  prompt: string;
  parentRunId: string;
}

interface SpawnResult {
  runId?: string;
  error?: string;
}

interface AwaitResult {
  status?: string;
  result?: any;
  error?: string;
}

/**
 * Spawn a child run under a bron
 * This creates a new run that can be executed independently
 */
export async function spawnBron(params: SpawnBronParams): Promise<SpawnResult> {
  try {
    const runId = uuidv4();

    // Create the child run
    await sql`
      INSERT INTO runs (id, bron_id, title, prompt, status, parent_run_id)
      VALUES (
        ${runId},
        ${params.bronId},
        ${params.title},
        ${params.prompt},
        'queued',
        ${params.parentRunId}
      )
    `;

    // Emit a child_run event to the parent
    const seqResult = await sql`
      SELECT COALESCE(MAX(seq), 0) + 1 as next_seq
      FROM run_events
      WHERE run_id = ${params.parentRunId}
    `;
    const nextSeq = seqResult[0]?.next_seq || 1;

    await sql`
      INSERT INTO run_events (run_id, type, payload, seq)
      VALUES (
        ${params.parentRunId},
        'child_run',
        ${JSON.stringify({
          child_run_id: runId,
          title: params.title,
          status: 'queued',
        })},
        ${nextSeq}
      )
    `;

    return { runId };
  } catch (err) {
    console.error('Failed to spawn bron:', err);
    return {
      error: err instanceof Error ? err.message : 'Failed to spawn child run',
    };
  }
}

/**
 * Wait for a child run to complete
 * Polls the run status until it reaches a terminal state
 */
export async function awaitBron(
  runId: string,
  options: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  } = {}
): Promise<AwaitResult> {
  const { timeoutMs = 300000, pollIntervalMs = 1000 } = options; // 5 min default timeout
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await sql`
        SELECT status, error FROM runs WHERE id = ${runId}
      `;

      if (result.length === 0) {
        return { error: 'Run not found' };
      }

      const run = result[0];
      const status = run.status;

      // Terminal states
      if (['succeeded', 'failed', 'canceled'].includes(status)) {
        // Get any artifacts or summary from the run
        const artifacts = await sql`
          SELECT kind, data FROM artifacts WHERE run_id = ${runId}
        `;

        return {
          status,
          result: {
            error: run.error,
            artifacts: artifacts.map((a: any) => ({
              kind: a.kind,
              data: a.data,
            })),
          },
        };
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (err) {
      console.error('Error polling run status:', err);
      // Continue polling despite errors
    }
  }

  return { error: 'Timeout waiting for run to complete' };
}

/**
 * Update parent run with child run status
 */
export async function updateChildRunStatus(
  parentRunId: string,
  childRunId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const seqResult = await sql`
      SELECT COALESCE(MAX(seq), 0) + 1 as next_seq
      FROM run_events
      WHERE run_id = ${parentRunId}
    `;
    const nextSeq = seqResult[0]?.next_seq || 1;

    // Get child run title
    const childRun = await sql`
      SELECT title FROM runs WHERE id = ${childRunId}
    `;
    const title = childRun[0]?.title || 'Child Run';

    await sql`
      INSERT INTO run_events (run_id, type, payload, seq)
      VALUES (
        ${parentRunId},
        'child_run',
        ${JSON.stringify({
          child_run_id: childRunId,
          title,
          status,
        })},
        ${nextSeq}
      )
    `;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update child run status',
    };
  }
}

/**
 * Get all child runs for a parent run
 */
export async function getChildRuns(parentRunId: string): Promise<{
  runs: Array<{ id: string; title: string; status: string }>;
  error?: string;
}> {
  try {
    const runs = await sql`
      SELECT id, title, status
      FROM runs
      WHERE parent_run_id = ${parentRunId}
      ORDER BY created_at ASC
    `;

    return {
      runs: runs.map((r: any) => ({
        id: r.id,
        title: r.title,
        status: r.status,
      })),
    };
  } catch (err) {
    return {
      runs: [],
      error: err instanceof Error ? err.message : 'Failed to get child runs',
    };
  }
}
