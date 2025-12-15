'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RunTimeline } from '@/components/run-timeline';
import { cn } from '@/lib/utils';
import type { Run } from '@/types/db';

interface Props {
  runId: string;
}

interface RunWithBron extends Run {
  bron_name: string;
  bron_avatar_color: string;
}

export function RunDetail({ runId }: Props) {
  const [run, setRun] = useState<RunWithBron | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRun = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}`);
        if (!response.ok) throw new Error('Run not found');
        const data = await response.json();
        setRun(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchRun();

    // Poll for status updates
    const interval = setInterval(fetchRun, 3000);
    return () => clearInterval(interval);
  }, [runId]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-5">
          <div className="shimmer h-14 w-14 rounded-xl" />
          <div className="space-y-3">
            <div className="shimmer h-7 w-64 rounded-lg" />
            <div className="shimmer h-5 w-32 rounded-lg" />
          </div>
        </div>
        <div className="shimmer h-24 rounded-2xl" />
        <div className="shimmer h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="text-6xl mb-6 opacity-50">⚠️</div>
        <p className="text-destructive mb-4">{error || 'Run not found'}</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/brons">Back to Agents</Link>
        </Button>
      </div>
    );
  }

  const statusConfig: Record<string, { class: string; label: string; icon: string }> = {
    queued: { class: 'idle', label: 'Queued', icon: '⏳' },
    running: { class: 'running', label: 'Running', icon: '🚀' },
    needs_approval: { class: 'warning', label: 'Awaiting Approval', icon: '⏸️' },
    succeeded: { class: 'success', label: 'Complete', icon: '✓' },
    failed: { class: 'error', label: 'Failed', icon: '✗' },
    canceled: { class: 'idle', label: 'Canceled', icon: '−' },
  };

  const status = statusConfig[run.status] || statusConfig.queued;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Avatar className="h-14 w-14 rounded-xl">
            <AvatarFallback
              style={{ backgroundColor: run.bron_avatar_color }}
              className="rounded-xl font-semibold"
            >
              {run.bron_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="heading-serif text-2xl">{run.title}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  run.status === 'succeeded'
                    ? 'bg-[oklch(0.70_0.18_145/0.15)] text-[oklch(0.80_0.15_145)]'
                    : run.status === 'failed'
                      ? 'bg-destructive/15 text-destructive'
                      : run.status === 'running'
                        ? 'bg-primary/15 text-primary'
                        : run.status === 'needs_approval'
                          ? 'bg-[oklch(0.70_0.16_85/0.15)] text-[oklch(0.85_0.14_85)]'
                          : 'bg-muted/50 text-muted-foreground'
                )}
              >
                <span className={cn('status-dot h-2 w-2', status.class)} />
                {status.label}
              </span>
            </div>
            <Link
              href={`/brons/${run.bron_id}`}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {run.bron_name}
            </Link>
          </div>
        </div>
        <Button variant="outline" asChild className="rounded-xl">
          <Link href={`/brons/${run.bron_id}`}>← Back to Agent</Link>
        </Button>
      </div>

      {/* Task */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-sm">📋</span>
            </div>
            <h3 className="font-semibold">Task</h3>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm leading-relaxed">{run.prompt}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-card rounded-2xl overflow-hidden min-h-[500px]">
        <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <span className="text-sm">📊</span>
              </div>
              <div>
                <h3 className="font-semibold">Run Progress</h3>
                <p className="text-xs text-muted-foreground">Real-time updates</p>
              </div>
            </div>
            {run.status === 'running' && (
              <div className="flex items-center gap-2">
                <span className="status-dot running h-2.5 w-2.5" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-6">
          <ScrollArea className="h-[450px] pr-4">
            <RunTimeline runId={runId} />
          </ScrollArea>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1">Created</p>
          <p className="text-sm font-medium">
            {new Date(run.created_at).toLocaleString()}
          </p>
        </div>
        {run.started_at && (
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Started</p>
            <p className="text-sm font-medium">
              {new Date(run.started_at).toLocaleString()}
            </p>
          </div>
        )}
        {run.finished_at && (
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Finished</p>
            <p className="text-sm font-medium">
              {new Date(run.finished_at).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {run.error && (
        <div className="rounded-2xl border-2 border-destructive bg-destructive/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-destructive/30 bg-destructive/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
                <span className="text-destructive">✗</span>
              </div>
              <h3 className="font-semibold text-destructive">Error</h3>
            </div>
          </div>
          <div className="p-6">
            <pre className="text-sm text-destructive whitespace-pre-wrap font-mono">
              {typeof run.error === 'string'
                ? run.error
                : JSON.stringify(run.error, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
