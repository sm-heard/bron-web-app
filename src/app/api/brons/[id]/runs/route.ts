import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Run } from '@/types/db';

// GET /api/brons/[id]/runs - Get run history for a bron
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // First check if bron exists
    const bronExists = await sql`
      SELECT 1 FROM brons WHERE id = ${id}
    `;

    if (bronExists.length === 0) {
      return NextResponse.json(
        { error: 'Bron not found' },
        { status: 404 }
      );
    }

    const rows = await sql`
      SELECT *
      FROM runs
      WHERE bron_id = ${id}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return NextResponse.json(rows as Run[]);
  } catch (error) {
    console.error('Failed to get runs:', error);
    return NextResponse.json(
      { error: 'Failed to get runs' },
      { status: 500 }
    );
  }
}
