// Gmail tools
export {
  gmailSearch,
  gmailGetMessage,
  gmailGetAttachment,
  gmailCreateDraft,
  gmailSendDraft,
} from './gmail';

// UI emission tools
export {
  emitUI,
  emitEmailSearchResults,
  emitAttachmentSummary,
  emitExtractedFields,
  emitEmailDraft,
  emitRunSummary,
  emitLog,
  emitStatus,
  emitToolUse,
} from './emit-ui';

// Orchestration tools
export {
  spawnBron,
  awaitBron,
  updateChildRunStatus,
  getChildRuns,
} from './orchestration';

// Tool definitions for Claude Agent SDK
export const toolDefinitions = [
  {
    name: 'gmail_search',
    description: 'Search Gmail messages by query. Returns matching message metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query (e.g., "from:john@example.com subject:invoice")',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'gmail_get_message',
    description: 'Get the full content of a Gmail message by ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        messageId: {
          type: 'string',
          description: 'The Gmail message ID',
        },
        format: {
          type: 'string',
          enum: ['minimal', 'full', 'metadata'],
          description: 'Format of the message to retrieve (default: full)',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'gmail_get_attachment',
    description: 'Download an attachment from a Gmail message.',
    input_schema: {
      type: 'object' as const,
      properties: {
        messageId: {
          type: 'string',
          description: 'The Gmail message ID',
        },
        attachmentId: {
          type: 'string',
          description: 'The attachment ID',
        },
      },
      required: ['messageId', 'attachmentId'],
    },
  },
  {
    name: 'gmail_create_draft',
    description: 'Create a draft email. The draft will need approval before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        bodyText: {
          type: 'string',
          description: 'Plain text body of the email',
        },
        cc: {
          type: 'array',
          items: { type: 'string' },
          description: 'CC recipients',
        },
        threadId: {
          type: 'string',
          description: 'Thread ID to reply to',
        },
      },
      required: ['to', 'subject', 'bodyText'],
    },
  },
  {
    name: 'emit_ui',
    description: 'Display a UI card to the user. Use this to show search results, extracted data, or draft emails.',
    input_schema: {
      type: 'object' as const,
      properties: {
        kind: {
          type: 'string',
          enum: ['EmailSearchResultsCard', 'AttachmentSummaryCard', 'ExtractedFieldsTable', 'EmailDraftCard', 'RunSummaryCard'],
          description: 'Type of UI card to display',
        },
        payload: {
          type: 'object',
          description: 'Card-specific data payload',
        },
      },
      required: ['kind', 'payload'],
    },
  },
  {
    name: 'spawn_bron',
    description: 'Spawn a child run to handle a sub-task. Returns the child run ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bronId: {
          type: 'string',
          description: 'ID of the bron to use for the child run',
        },
        title: {
          type: 'string',
          description: 'Title for the child run',
        },
        prompt: {
          type: 'string',
          description: 'Task prompt for the child run',
        },
      },
      required: ['bronId', 'title', 'prompt'],
    },
  },
  {
    name: 'await_bron',
    description: 'Wait for a child run to complete and get its results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        runId: {
          type: 'string',
          description: 'ID of the child run to wait for',
        },
        timeoutMs: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 300000 = 5 minutes)',
        },
      },
      required: ['runId'],
    },
  },
];
