import { NextResponse } from 'next/server';

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Gmail scopes needed for the app
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    );
  }

  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Build OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
    state,
  });

  const authUrl = `${GOOGLE_OAUTH_URL}?${params.toString()}`;

  // Redirect to Google OAuth
  return NextResponse.redirect(authUrl);
}
