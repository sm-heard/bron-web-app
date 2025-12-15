'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Bron, Run } from '@/types/db';

interface Props {
  bronId: string;
}

export function BronDetail({ bronId }: Props) {
  const [bron, setBron] = useState<Bron | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'runs' | 'settings'>('runs');

  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bronRes, runsRes] = await Promise.all([
          fetch(`/api/brons/${bronId}`),
          fetch(`/api/brons/${bronId}/runs`),
        ]);

        if (!bronRes.ok) throw new Error('Agent not found');

        const bronData = await bronRes.json();
        const runsData = await runsRes.json();

        setBron(bronData);
        setRuns(runsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bronId]);

  const handleStartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bron_id: bronId,
          prompt: prompt.trim(),
        }),
      });

      if (response.ok) {
        const run = await response.json();
        setPrompt('');
        window.location.href = `/runs/${run.id}`;
      }
    } catch (error) {
      console.error('Failed to create run:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-5">
          <div className="shimmer h-20 w-20 rounded-2xl" />
          <div className="space-y-3">
            <div className="shimmer h-8 w-48 rounded-lg" />
            <div className="shimmer h-5 w-32 rounded-lg" />
          </div>
        </div>
        <div className="shimmer h-48 rounded-2xl" />
        <div className="shimmer h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !bron) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="text-6xl mb-6 opacity-50">⚠️</div>
        <p className="text-destructive mb-4">{error || 'Agent not found'}</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/brons">Back to Agents</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 rounded-2xl">
            <AvatarFallback
              style={{ backgroundColor: bron.avatar_color }}
              className="rounded-2xl text-2xl font-semibold"
            >
              {bron.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="heading-serif text-3xl text-gradient-warm">{bron.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Created {new Date(bron.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild className="rounded-xl">
          <Link href="/brons">← Back</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/50 w-fit">
        <button
          onClick={() => setActiveTab('runs')}
          className={cn(
            'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
            activeTab === 'runs'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          Runs
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
            activeTab === 'settings'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          Configuration
        </button>
      </div>

      {/* Runs Tab */}
      {activeTab === 'runs' && (
        <div className="space-y-6">
          {/* New Task */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
              <h3 className="font-semibold">New Task</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Describe what you want this agent to do
              </p>
            </div>
            <div className="p-6">
              <form onSubmit={handleStartTask} className="space-y-4">
                <Textarea
                  placeholder="Find the latest invoice from Acme Corp and extract the total amount..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="resize-none rounded-xl border-border/50 bg-muted/30 focus-visible:ring-primary/50"
                />
                <Button
                  type="submit"
                  disabled={!prompt.trim() || isSubmitting}
                  className="rounded-xl px-6 glow-primary"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="status-dot running h-2 w-2" />
                      Launching...
                    </span>
                  ) : (
                    'Launch'
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Run History */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
              <h3 className="font-semibold">Run History</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {runs.length} run{runs.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="p-4">
              {runs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl opacity-50">🚀</span>
                  </div>
                  <p className="text-muted-foreground">No runs yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Start your first task above
                  </p>
                </div>
              ) : (
                <div className="space-y-2 stagger-fade-in">
                  {runs.map((run) => (
                    <RunItem key={run.id} run={run} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
              <h3 className="font-semibold">System Instructions</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Core directives for this agent
              </p>
            </div>
            <div className="p-6">
              <pre className="text-sm whitespace-pre-wrap p-4 rounded-xl bg-muted/30 border border-border/50 font-mono">
                {bron.system_prompt || 'No system instructions configured'}
              </pre>
            </div>
          </div>

          {bron.memory_summary && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
                <h3 className="font-semibold">Memory Summary</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Learned context from previous runs
                </p>
              </div>
              <div className="p-6">
                <pre className="text-sm whitespace-pre-wrap p-4 rounded-xl bg-muted/30 border border-border/50 font-mono">
                  {bron.memory_summary}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunItem({ run }: { run: Run }) {
  const statusConfig: Record<string, { class: string; label: string }> = {
    queued: { class: 'idle', label: 'Queued' },
    running: { class: 'running', label: 'Running' },
    needs_approval: { class: 'warning', label: 'Awaiting' },
    succeeded: { class: 'success', label: 'Complete' },
    failed: { class: 'error', label: 'Failed' },
    canceled: { class: 'idle', label: 'Canceled' },
  };

  const status = statusConfig[run.status] || statusConfig.queued;

  return (
    <Link href={`/runs/${run.id}`}>
      <div
        className={cn(
          'p-4 rounded-xl border border-border/50 bg-muted/20',
          'hover:bg-muted/30 hover:border-primary/30 transition-all cursor-pointer card-hover'
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className={cn('status-dot h-2.5 w-2.5', status.class)} />
            <span className="font-medium text-sm">{run.title}</span>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium capitalize',
              run.status === 'succeeded'
                ? 'bg-[oklch(0.70_0.18_145/0.15)] text-[oklch(0.80_0.15_145)]'
                : run.status === 'failed'
                  ? 'bg-destructive/15 text-destructive'
                  : run.status === 'running'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted/50 text-muted-foreground'
            )}
          >
            {status.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
          {run.prompt}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {new Date(run.created_at).toLocaleString()}
        </p>
      </div>
    </Link>
  );
}
