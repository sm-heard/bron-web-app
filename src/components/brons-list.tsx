'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { BronWithLatestRun } from '@/types/db';

export function BronsList() {
  const [brons, setBrons] = useState<BronWithLatestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrons = async () => {
    try {
      const response = await fetch('/api/brons');
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setBrons(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrons();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="shimmer h-10 w-48 rounded-lg mb-2" />
            <div className="shimmer h-5 w-64 rounded-lg" />
          </div>
          <div className="shimmer h-11 w-36 rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="text-6xl mb-6 opacity-50">⚠️</div>
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchBrons} variant="outline" className="rounded-xl">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-serif text-4xl text-gradient-warm">Your Agents</h1>
          <p className="text-muted-foreground mt-2">
            AI assistants ready to execute your tasks
          </p>
        </div>
        <CreateBronDialog onCreated={fetchBrons} />
      </div>

      {/* Empty State */}
      {brons.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🤖</span>
            </div>
            <h3 className="heading-serif text-2xl mb-2">No agents yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first AI agent to start automating tasks like email search,
              data extraction, and draft composition.
            </p>
            <CreateBronDialog onCreated={fetchBrons} />
          </div>
        </div>
      ) : (
        /* Agent Grid */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-fade-in">
          {brons.map((bron) => (
            <BronCard key={bron.id} bron={bron} />
          ))}
        </div>
      )}
    </div>
  );
}

function BronCard({ bron }: { bron: BronWithLatestRun }) {
  const statusMap: Record<string, { class: string; label: string }> = {
    queued: { class: 'idle', label: 'Queued' },
    running: { class: 'running', label: 'Running' },
    needs_approval: { class: 'warning', label: 'Awaiting' },
    succeeded: { class: 'success', label: 'Complete' },
    failed: { class: 'error', label: 'Failed' },
    canceled: { class: 'idle', label: 'Canceled' },
  };

  const status = bron.latest_run
    ? statusMap[bron.latest_run.status] || statusMap.queued
    : null;

  return (
    <Link href={`/brons/${bron.id}`}>
      <div
        className={cn(
          'glass-card rounded-2xl p-6 h-full card-hover cursor-pointer',
          'border border-border/50'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <Avatar className="h-14 w-14 rounded-xl">
            <AvatarFallback
              style={{ backgroundColor: bron.avatar_color }}
              className="rounded-xl text-lg font-semibold"
            >
              {bron.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {status && (
            <div className="flex items-center gap-2">
              <span className={cn('status-dot h-2 w-2', status.class)} />
              <span className="text-xs text-muted-foreground">{status.label}</span>
            </div>
          )}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-lg mb-1 truncate">{bron.name}</h3>

        {/* Latest Run */}
        {bron.latest_run ? (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {bron.latest_run.title}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {formatRelativeTime(new Date(bron.latest_run.created_at))}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/70 mt-4">No runs yet</p>
        )}
      </div>
    </Link>
  );
}

function CreateBronDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/brons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          system_prompt: systemPrompt.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create agent');
      }

      setName('');
      setSystemPrompt('');
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl px-6 glow-primary">
          <span className="mr-2">+</span>
          New Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border/50 rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="heading-serif text-2xl">Create Agent</DialogTitle>
          <DialogDescription>
            Deploy a new AI assistant to handle your tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="name"
              placeholder="Email Assistant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border-border/50 bg-muted/30 focus-visible:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="system-prompt" className="text-sm font-medium">
              Instructions{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="system-prompt"
              placeholder="Specialized instructions for this agent..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="resize-none rounded-xl border-border/50 bg-muted/30 focus-visible:ring-primary/50"
            />
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="rounded-xl px-6"
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <span className="status-dot running h-2 w-2" />
                Creating...
              </span>
            ) : (
              'Create Agent'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
