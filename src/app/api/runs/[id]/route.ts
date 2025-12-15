import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Run } from '@/types/db';

// GET /api/runs/[id] - Get a single run with its bron info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql`
      SELECT
        r.*,
        b.name as bron_name,
        b.avatar_color as bron_avatar_color
      FROM runs r
      JOIN brons b ON b.id = r.bron_id
      WHERE r.id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    const row = rows[0];
    const run: Run & { bron_name: string; bron_avatar_color: string } = {
      id: row.id,
      bron_id: row.bron_id,
      parent_run_id: row.parent_run_id,
      title: row.title,
      prompt: row.prompt,
      status: row.status,
      approval_token_hash: row.approval_token_hash,
      created_at: row.created_at,
      started_at: row.started_at,
      finished_at: row.finished_at,
      error: row.error,
      bron_name: row.bron_name,
      bron_avatar_color: row.bron_avatar_color,
    };

    return NextResponse.json(run);
  } catch (error) {
    console.error('Failed to get run:', error);
    return NextResponse.json(
      { error: 'Failed to get run' },
      { status: 500 }
    );
  }
}
