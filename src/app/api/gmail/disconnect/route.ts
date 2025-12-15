import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST() {
  try {
    // Delete all Gmail OAuth tokens
    // In a multi-user app, you'd filter by user ID
    await sql`
      DELETE FROM oauth_tokens
      WHERE provider = 'gmail'
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to disconnect Gmail:', err);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail' },
      { status: 500 }
    );
  }
}
