import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';
import type { Bron } from '@/types/db';

// Validation schema for updates
const updateBronSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  system_prompt: z.string().max(10000).optional(),
  memory_summary: z.string().max(50000).nullable().optional(),
});

// GET /api/brons/[id] - Get a single bron
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql`
      SELECT * FROM brons WHERE id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Bron not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0] as Bron);
  } catch (error) {
    console.error('Failed to get bron:', error);
    return NextResponse.json(
      { error: 'Failed to get bron' },
      { status: 500 }
    );
  }
}

// PATCH /api/brons/[id] - Update a bron
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateBronSchema.parse(body);

    // Check if there are any fields to update
    const hasUpdates = Object.values(data).some((v) => v !== undefined);
    if (!hasUpdates) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Fetch current bron first
    const existing = await sql`SELECT * FROM brons WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Bron not found' },
        { status: 404 }
      );
    }

    // Apply updates with defaults from existing
    const name = data.name ?? existing[0].name;
    const avatar_color = data.avatar_color ?? existing[0].avatar_color;
    const system_prompt = data.system_prompt ?? existing[0].system_prompt;
    const memory_summary = data.memory_summary !== undefined
      ? data.memory_summary
      : existing[0].memory_summary;

    const rows = await sql`
      UPDATE brons
      SET
        name = ${name},
        avatar_color = ${avatar_color},
        system_prompt = ${system_prompt},
        memory_summary = ${memory_summary}
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(rows[0] as Bron);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Failed to update bron:', error);
    return NextResponse.json(
      { error: 'Failed to update bron' },
      { status: 500 }
    );
  }
}
