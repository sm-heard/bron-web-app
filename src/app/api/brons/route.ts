import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { Bron, BronWithLatestRun } from '@/types/db';

// Validation schema
const createBronSchema = z.object({
  name: z.string().min(1).max(100),
  avatar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  system_prompt: z.string().max(10000).optional(),
});

// GET /api/brons - List all brons with their latest run
export async function GET() {
  try {
    const rows = await sql`
      SELECT
        b.*,
        r.id as latest_run_id,
        r.title as latest_run_title,
        r.status as latest_run_status,
        r.created_at as latest_run_created_at
      FROM brons b
      LEFT JOIN LATERAL (
        SELECT id, title, status, created_at
        FROM runs
        WHERE bron_id = b.id
        ORDER BY created_at DESC
        LIMIT 1
      ) r ON true
      ORDER BY b.updated_at DESC
    `;

    const brons: BronWithLatestRun[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar_color: row.avatar_color,
      system_prompt: row.system_prompt,
      memory_summary: row.memory_summary,
      created_at: row.created_at,
      updated_at: row.updated_at,
      latest_run: row.latest_run_id
        ? {
            id: row.latest_run_id,
            title: row.latest_run_title,
            status: row.latest_run_status,
            created_at: row.latest_run_created_at,
          }
        : null,
    }));

    return NextResponse.json(brons);
  } catch (error) {
    console.error('Failed to list brons:', error);
    return NextResponse.json(
      { error: 'Failed to list brons' },
      { status: 500 }
    );
  }
}

// POST /api/brons - Create a new bron
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createBronSchema.parse(body);

    const id = uuidv4();
    const avatar_color = data.avatar_color || generateRandomColor();
    const system_prompt = data.system_prompt || getDefaultSystemPrompt();

    const rows = await sql`
      INSERT INTO brons (id, name, avatar_color, system_prompt)
      VALUES (${id}, ${data.name}, ${avatar_color}, ${system_prompt})
      RETURNING *
    `;

    return NextResponse.json(rows[0] as Bron, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Failed to create bron:', error);
    return NextResponse.json(
      { error: 'Failed to create bron' },
      { status: 500 }
    );
  }
}

// Helper to generate a random color
function generateRandomColor(): string {
  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e', // rose
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Default system prompt for new brons
function getDefaultSystemPrompt(): string {
  return `You are a helpful personal AI assistant. You can help with various tasks including:
- Searching and reading emails
- Extracting information from attachments
- Drafting and sending emails (with user approval)

Always be clear about what you're doing and ask for confirmation before taking important actions.`;
}
