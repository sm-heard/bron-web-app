import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { decryptTokens } from '@/lib/encryption';

export async function GET() {
  try {
    // Check for Gmail OAuth tokens
    const tokens = await sql`
      SELECT account_id, expires_at, updated_at
      FROM oauth_tokens
      WHERE provider = 'gmail'
      LIMIT 1
    `;

    if (tokens.length === 0) {
      return NextResponse.json({
        connected: false,
        email: null,
      });
    }

    const token = tokens[0];
    const isExpired = token.expires_at && new Date(token.expires_at) < new Date();

    return NextResponse.json({
      connected: true,
      email: token.account_id,
      expiresAt: token.expires_at,
      isExpired,
      updatedAt: token.updated_at,
    });
  } catch (err) {
    console.error('Failed to check Gmail status:', err);
    return NextResponse.json(
      { error: 'Failed to check Gmail status' },
      { status: 500 }
    );
  }
}
