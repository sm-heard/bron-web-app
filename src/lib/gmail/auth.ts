import { sql } from '@/lib/db';
import { decryptTokens, encryptTokens } from '@/lib/encryption';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

/**
 * Get valid Gmail access token, refreshing if necessary
 */
export async function getGmailAccessToken(): Promise<string | null> {
  try {
    // Get stored tokens
    const tokenRecords = await sql`
      SELECT encrypted_tokens, expires_at
      FROM oauth_tokens
      WHERE provider = 'gmail'
      LIMIT 1
    `;

    if (tokenRecords.length === 0) {
      return null;
    }

    const record = tokenRecords[0];
    const tokens = decryptTokens(record.encrypted_tokens);

    // Check if token is still valid (with 5 min buffer)
    const isExpired = tokens.expiry_date
      ? tokens.expiry_date < Date.now() + 5 * 60 * 1000
      : false;

    if (!isExpired) {
      return tokens.access_token;
    }

    // Token expired, try to refresh
    if (!tokens.refresh_token) {
      console.error('No refresh token available');
      return null;
    }

    const refreshedTokens = await refreshAccessToken(tokens.refresh_token);
    if (!refreshedTokens) {
      return null;
    }

    // Update stored tokens
    const encryptedTokens = encryptTokens({
      access_token: refreshedTokens.access_token,
      refresh_token: tokens.refresh_token, // Keep original refresh token
      expiry_date: refreshedTokens.expiry_date,
    });

    await sql`
      UPDATE oauth_tokens
      SET encrypted_tokens = ${encryptedTokens},
          expires_at = ${new Date(refreshedTokens.expiry_date!).toISOString()},
          updated_at = NOW()
      WHERE provider = 'gmail'
    `;

    return refreshedTokens.access_token;
  } catch (err) {
    console.error('Failed to get Gmail access token:', err);
    return null;
  }
}

/**
 * Refresh an access token using the refresh token
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<GmailTokens | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Google OAuth not configured');
    return null;
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Token refresh failed:', errorData);
      return null;
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      expiry_date: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
    };
  } catch (err) {
    console.error('Failed to refresh token:', err);
    return null;
  }
}

/**
 * Check if Gmail is connected
 */
export async function isGmailConnected(): Promise<boolean> {
  try {
    const tokens = await sql`
      SELECT id FROM oauth_tokens
      WHERE provider = 'gmail'
      LIMIT 1
    `;
    return tokens.length > 0;
  } catch {
    return false;
  }
}
