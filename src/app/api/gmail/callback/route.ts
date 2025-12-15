import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { encryptTokens } from '@/lib/encryption';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      new URL(`/brons?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/brons?error=no_code', request.url)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL('/brons?error=oauth_not_configured', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/brons?error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Get user's email address for identification
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let email = 'default';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      email = userInfo.email || 'default';
    }

    // Encrypt tokens before storage
    const encryptedTokens = encryptTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
    });

    // Store in database (upsert)
    await sql`
      INSERT INTO oauth_tokens (provider, account_id, encrypted_tokens, expires_at)
      VALUES (
        'gmail',
        ${email},
        ${encryptedTokens},
        ${tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null}
      )
      ON CONFLICT (provider, account_id)
      DO UPDATE SET
        encrypted_tokens = ${encryptedTokens},
        expires_at = ${tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null},
        updated_at = NOW()
    `;

    // Redirect back to app with success
    return NextResponse.redirect(
      new URL('/brons?gmail=connected', request.url)
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      new URL('/brons?error=callback_failed', request.url)
    );
  }
}
