import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { resumeRunAfterApproval } from '@/lib/runner';

const approveSchema = z.object({
  approved: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  try {
    const body = await request.json();
    const { approved } = approveSchema.parse(body);

    // Verify run exists and is in needs_approval state
    const runs = await sql`
      SELECT status FROM runs WHERE id = ${runId}
    `;

    if (runs.length === 0) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (runs[0].status !== 'needs_approval') {
      return NextResponse.json(
        { error: 'Run is not awaiting approval' },
        { status: 400 }
      );
    }

    // Generate approval token
    const approvalToken = crypto.randomUUID();

    // Resume the run with the approval decision
    const result = await resumeRunAfterApproval(runId, approved, approvalToken);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: result.finalStatus,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Approve send error:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
