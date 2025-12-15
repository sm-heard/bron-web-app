import { getGmailAccessToken } from '@/lib/gmail/auth';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailSearchResult {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  headers: {
    subject: string;
    from: string;
    to: string;
    date: string;
    cc?: string;
  };
  body: {
    text?: string;
    html?: string;
  };
  attachments: Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  data: string; // base64 encoded
}

interface GmailDraft {
  id: string;
  message: {
    id: string;
    threadId: string;
  };
}

/**
 * Search Gmail messages
 */
export async function gmailSearch(params: {
  query: string;
  maxResults?: number;
}): Promise<{ messages: GmailSearchResult[]; error?: string }> {
  const accessToken = await getGmailAccessToken();
  if (!accessToken) {
    return { messages: [], error: 'Gmail not connected' };
  }

  try {
    const searchParams = new URLSearchParams({
      q: params.query,
      maxResults: String(params.maxResults || 10),
    });

    const response = await fetch(
      `${GMAIL_API_BASE}/messages?${searchParams}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { messages: [], error: error.error?.message || 'Search failed' };
    }

    const data = await response.json();
    const messageIds = data.messages || [];

    // Fetch message details in parallel
    const messages = await Promise.all(
      messageIds.slice(0, params.maxResults || 10).map(async (msg: { id: string }) => {
        const details = await fetchMessageMetadata(accessToken, msg.id);
        return details;
      })
    );

    return { messages: messages.filter(Boolean) as GmailSearchResult[] };
  } catch (err) {
    return { messages: [], error: err instanceof Error ? err.message : 'Search failed' };
  }
}

/**
 * Get a specific Gmail message
 */
export async function gmailGetMessage(params: {
  messageId: string;
  format?: 'minimal' | 'full' | 'metadata';
}): Promise<{ message?: GmailMessage; error?: string }> {
  const accessToken = await getGmailAccessToken();
  if (!accessToken) {
    return { error: 'Gmail not connected' };
  }

  try {
    const format = params.format || 'full';
    const response = await fetch(
      `${GMAIL_API_BASE}/messages/${params.messageId}?format=${format}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error?.message || 'Failed to get message' };
    }

    const data = await response.json();
    const message = parseMessage(data);

    return { message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to get message' };
  }
}

/**
 * Get an attachment from a Gmail message
 */
export async function gmailGetAttachment(params: {
  messageId: string;
  attachmentId: string;
}): Promise<{ attachment?: GmailAttachment; error?: string }> {
  const accessToken = await getGmailAccessToken();
  if (!accessToken) {
    return { error: 'Gmail not connected' };
  }

  try {
    // First get the message to get attachment metadata
    const msgResponse = await fetch(
      `${GMAIL_API_BASE}/messages/${params.messageId}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!msgResponse.ok) {
      return { error: 'Failed to get message' };
    }

    const msgData = await msgResponse.json();
    const attachmentMeta = findAttachmentMeta(msgData, params.attachmentId);

    if (!attachmentMeta) {
      return { error: 'Attachment not found' };
    }

    // Fetch attachment data
    const response = await fetch(
      `${GMAIL_API_BASE}/messages/${params.messageId}/attachments/${params.attachmentId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error?.message || 'Failed to get attachment' };
    }

    const data = await response.json();

    return {
      attachment: {
        attachmentId: params.attachmentId,
        filename: attachmentMeta.filename,
        mimeType: attachmentMeta.mimeType,
        size: data.size,
        data: data.data, // base64url encoded
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to get attachment' };
  }
}

/**
 * Create a draft email
 */
export async function gmailCreateDraft(params: {
  to: string;
  subject: string;
  bodyText: string;
  cc?: string[];
  threadId?: string;
}): Promise<{ draft?: GmailDraft; error?: string }> {
  const accessToken = await getGmailAccessToken();
  if (!accessToken) {
    return { error: 'Gmail not connected' };
  }

  try {
    // Build RFC 2822 message
    const messageParts = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
    ];

    if (params.cc && params.cc.length > 0) {
      messageParts.push(`Cc: ${params.cc.join(', ')}`);
    }

    messageParts.push('', params.bodyText);

    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const body: { message: { raw: string; threadId?: string } } = {
      message: { raw: encodedMessage },
    };

    if (params.threadId) {
      body.message.threadId = params.threadId;
    }

    const response = await fetch(`${GMAIL_API_BASE}/drafts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error?.message || 'Failed to create draft' };
    }

    const draft = await response.json();
    return { draft };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create draft' };
  }
}

/**
 * Send a draft (requires approval token)
 */
export async function gmailSendDraft(params: {
  draftId: string;
  approvalToken: string;
}): Promise<{ messageId?: string; error?: string }> {
  // Validate approval token (in production, verify this cryptographically)
  if (!params.approvalToken || params.approvalToken.length < 10) {
    return { error: 'Invalid approval token' };
  }

  const accessToken = await getGmailAccessToken();
  if (!accessToken) {
    return { error: 'Gmail not connected' };
  }

  try {
    const response = await fetch(`${GMAIL_API_BASE}/drafts/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: params.draftId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error?.message || 'Failed to send draft' };
    }

    const result = await response.json();
    return { messageId: result.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send draft' };
  }
}

// Helper functions

async function fetchMessageMetadata(
  accessToken: string,
  messageId: string
): Promise<GmailSearchResult | null> {
  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const headers = parseHeaders(data.payload?.headers || []);

    return {
      messageId: data.id,
      threadId: data.threadId,
      subject: headers.subject || '(no subject)',
      from: headers.from || '',
      date: headers.date || '',
      snippet: data.snippet || '',
    };
  } catch {
    return null;
  }
}

function parseHeaders(
  headers: Array<{ name: string; value: string }>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers) {
    result[h.name.toLowerCase()] = h.value;
  }
  return result;
}

function parseMessage(data: any): GmailMessage {
  const headers = parseHeaders(data.payload?.headers || []);
  const attachments: GmailMessage['attachments'] = [];
  let textBody = '';
  let htmlBody = '';

  // Extract body and attachments from parts
  function processParts(parts: any[] = []) {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size || 0,
        });
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody = Buffer.from(part.body.data, 'base64url').toString('utf8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = Buffer.from(part.body.data, 'base64url').toString('utf8');
      } else if (part.parts) {
        processParts(part.parts);
      }
    }
  }

  if (data.payload?.parts) {
    processParts(data.payload.parts);
  } else if (data.payload?.body?.data) {
    textBody = Buffer.from(data.payload.body.data, 'base64url').toString('utf8');
  }

  return {
    id: data.id,
    threadId: data.threadId,
    labelIds: data.labelIds || [],
    snippet: data.snippet || '',
    headers: {
      subject: headers.subject || '',
      from: headers.from || '',
      to: headers.to || '',
      date: headers.date || '',
      cc: headers.cc,
    },
    body: {
      text: textBody,
      html: htmlBody,
    },
    attachments,
  };
}

function findAttachmentMeta(
  msgData: any,
  attachmentId: string
): { filename: string; mimeType: string } | null {
  function searchParts(parts: any[] = []): any {
    for (const part of parts) {
      if (part.body?.attachmentId === attachmentId) {
        return { filename: part.filename, mimeType: part.mimeType };
      }
      if (part.parts) {
        const found = searchParts(part.parts);
        if (found) return found;
      }
    }
    return null;
  }

  return searchParts(msgData.payload?.parts || []);
}
