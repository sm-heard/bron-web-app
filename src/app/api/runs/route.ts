import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { Run } from '@/types/db';

// Validation schema
const createRunSchema = z.object({
  bron_id: z.string().uuid(),
  title: z.string().max(200).optional(),
  prompt: z.string().min(1).max(10000),
  upload_ids: z.array(z.string().uuid()).optional(),
  autoStart: z.boolean().optional().default(true),
});

// POST /api/runs - Create a new run
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createRunSchema.parse(body);

    // Check if bron exists
    const bronExists = await sql`
      SELECT 1 FROM brons WHERE id = ${data.bron_id}
    `;

    if (bronExists.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const id = uuidv4();
    const title = data.title || generateTitle(data.prompt);

    // Create the run in queued status
    const rows = await sql`
      INSERT INTO runs (id, bron_id, title, prompt, status)
      VALUES (${id}, ${data.bron_id}, ${title}, ${data.prompt}, 'queued')
      RETURNING *
    `;

    // Create initial status event
    await sql`
      INSERT INTO run_events (run_id, seq, type, payload)
      VALUES (${id}, 1, 'status', ${JSON.stringify({ status: 'queued' })})
    `;

    const run = rows[0] as Run;

    // Trigger workflow execution asynchronously
    if (data.autoStart) {
      // Fire and forget - trigger the execute endpoint
      const baseUrl = getBaseUrl(request);
      fetch(`${baseUrl}/api/runs/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch((err) => {
        console.error('Failed to trigger workflow:', err);
      });
    }

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Failed to create run:', error);
    return NextResponse.json(
      { error: 'Failed to create run' },
      { status: 500 }
    );
  }
}

// Generate a title from the prompt
function generateTitle(prompt: string): string {
  // Take first 50 chars, trim to last space if needed
  let title = prompt.slice(0, 50);
  if (prompt.length > 50) {
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 20) {
      title = title.slice(0, lastSpace);
    }
    title += '...';
  }
  return title;
}

// Get the base URL for internal API calls
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
