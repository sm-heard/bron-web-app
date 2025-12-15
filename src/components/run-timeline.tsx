'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRunEvents } from '@/hooks/useRunEvents';
import type {
  RunEvent,
  RunEventPayload,
  UIEventPayload,
  EmailSearchResultsPayload,
  AttachmentSummaryPayload,
  ExtractedFieldsPayload,
  EmailDraftPayload,
  RunSummaryPayload,
} from '@/types/db';
import { EmailSearchResultsCard } from '@/components/cards/email-search-results-card';
import { AttachmentSummaryCard } from '@/components/cards/attachment-summary-card';
import { ExtractedFieldsCard } from '@/components/cards/extracted-fields-card';
import { EmailDraftCard } from '@/components/cards/email-draft-card';
import { RunSummaryCard } from '@/components/cards/run-summary-card';

interface RunTimelineProps {
  runId: string;
}

export function RunTimeline({ runId }: RunTimelineProps) {
  const { events, isConnected, error, reconnect } = useRunEvents(runId);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4 opacity-50">⚠️</div>
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={reconnect} variant="outline" className="rounded-xl">
          Reconnect
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="status-dot running h-4 w-4 mb-4" />
        <p className="text-muted-foreground">
          {isConnected ? 'Waiting for events...' : 'Connecting...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 timeline-line stagger-fade-in">
      {events.map((event) => (
        <EventItem key={event.id} event={event} runId={runId} />
      ))}
    </div>
  );
}

function EventItem({ event, runId }: { event: RunEvent; runId: string }) {
  const payload = event.payload as RunEventPayload;

  switch (event.type) {
    case 'status':
      return <StatusEvent payload={payload as { status: string }} />;
    case 'log':
      return <LogEvent payload={payload as { message: string; level?: string }} />;
    case 'message':
      return <MessageEvent payload={payload as { role: string; content: string }} />;
    case 'tool':
      return <ToolEvent payload={payload as { name: string; phase: string }} />;
    case 'ui':
      return <UIEvent payload={payload as UIEventPayload} runId={runId} />;
    case 'artifact':
      return <ArtifactEvent payload={payload as { kind: string }} />;
    case 'child_run':
      return <ChildRunEvent payload={payload as { child_run_id: string; title: string; status: string }} />;
    default:
      return null;
  }
}

function StatusEvent({ payload }: { payload: { status: string } }) {
  const statusConfig: Record<string, { class: string; label: string; icon: string }> = {
    queued: { class: 'idle', label: 'Run Queued', icon: '⏳' },
    running: { class: 'running', label: 'Running', icon: '🚀' },
    needs_approval: { class: 'warning', label: 'Awaiting Approval', icon: '⏸️' },
    succeeded: { class: 'success', label: 'Complete', icon: '✓' },
    failed: { class: 'error', label: 'Failed', icon: '✗' },
    canceled: { class: 'idle', label: 'Canceled', icon: '−' },
  };

  const config = statusConfig[payload.status] || statusConfig.queued;

  return (
    <div className="flex items-center gap-3 py-3">
      <span className={cn('status-dot h-3 w-3', config.class)} />
      <span className="font-medium">{config.label}</span>
    </div>
  );
}

function LogEvent({ payload }: { payload: { message: string; level?: string } }) {
  const levelStyles: Record<string, string> = {
    info: 'text-muted-foreground',
    warn: 'text-[oklch(0.80_0.16_85)]',
    error: 'text-destructive',
  };

  return (
    <div className={cn('flex items-start gap-3 py-2', levelStyles[payload.level || 'info'])}>
      <span className="status-dot idle h-2 w-2 mt-1.5 shrink-0" />
      <span className="text-sm">{payload.message}</span>
    </div>
  );
}

function MessageEvent({ payload }: { payload: { role: string; content: string } }) {
  const isAssistant = payload.role === 'assistant';

  return (
    <div
      className={cn(
        'p-4 rounded-xl',
        isAssistant
          ? 'bg-muted/50 border border-border/50'
          : 'bg-primary/10 border border-primary/20'
      )}
    >
      <Badge
        variant="outline"
        className={cn(
          'mb-3 rounded-lg text-xs',
          isAssistant ? 'border-border/50' : 'border-primary/30 text-primary'
        )}
      >
        {payload.role === 'assistant' ? 'Agent' : 'You'}
      </Badge>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{payload.content}</p>
    </div>
  );
}

function ToolEvent({ payload }: { payload: { name: string; phase: string } }) {
  const isStart = payload.phase === 'start';

  return (
    <div className="flex items-center gap-3 py-2">
      <span className={cn('status-dot h-2 w-2', isStart ? 'running' : 'success')} />
      <Badge
        variant="secondary"
        className="rounded-lg text-xs bg-secondary/50"
      >
        {payload.name}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {isStart ? 'Executing...' : 'Complete'}
      </span>
    </div>
  );
}

function UIEvent({ payload, runId }: { payload: UIEventPayload; runId: string }) {
  // Type assertion needed since payload.payload is a union type
  // The switch on payload.kind narrows the type at runtime
  switch (payload.kind) {
    case 'EmailSearchResultsCard':
      return <EmailSearchResultsCard payload={payload.payload as EmailSearchResultsPayload} />;
    case 'AttachmentSummaryCard':
      return <AttachmentSummaryCard payload={payload.payload as AttachmentSummaryPayload} />;
    case 'ExtractedFieldsTable':
      return <ExtractedFieldsCard payload={payload.payload as ExtractedFieldsPayload} />;
    case 'EmailDraftCard':
      return <EmailDraftCard payload={payload.payload as EmailDraftPayload} runId={runId} />;
    case 'RunSummaryCard':
      return <RunSummaryCard payload={payload.payload as RunSummaryPayload} />;
    default:
      return null;
  }
}

function ArtifactEvent({ payload }: { payload: { kind: string } }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="status-dot success h-2 w-2" />
      <span className="text-sm text-muted-foreground">
        Artifact saved: <span className="text-foreground">{payload.kind}</span>
      </span>
    </div>
  );
}

function ChildRunEvent({
  payload,
}: {
  payload: { child_run_id: string; title: string; status: string };
}) {
  const statusConfig: Record<string, string> = {
    queued: 'idle',
    running: 'running',
    needs_approval: 'warning',
    succeeded: 'success',
    failed: 'error',
    canceled: 'idle',
  };

  return (
    <div className="p-4 border border-border/50 rounded-xl bg-card/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('status-dot h-2 w-2', statusConfig[payload.status] || 'idle')} />
          <span className="text-sm font-medium">{payload.title}</span>
        </div>
        <Badge variant="outline" className="rounded-lg text-xs capitalize">
          {payload.status}
        </Badge>
      </div>
    </div>
  );
}
