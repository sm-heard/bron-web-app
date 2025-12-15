import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { RunEvent } from '@/types/db';

// GET /api/runs/[id]/events - Get run events (polling endpoint)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const afterSeq = parseInt(searchParams.get('afterSeq') || '0');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    // Check if run exists
    const runExists = await sql`
      SELECT 1 FROM runs WHERE id = ${id}
    `;

    if (runExists.length === 0) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    const rows = await sql`
      SELECT *
      FROM run_events
      WHERE run_id = ${id}
        AND seq > ${afterSeq}
      ORDER BY seq ASC
      LIMIT ${limit}
    `;

    return NextResponse.json(rows as RunEvent[]);
  } catch (error) {
    console.error('Failed to get run events:', error);
    return NextResponse.json(
      { error: 'Failed to get run events' },
      { status: 500 }
    );
  }
}
