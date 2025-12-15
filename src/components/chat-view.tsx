'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RunTimeline } from '@/components/run-timeline';
import { cn } from '@/lib/utils';

export function ChatView() {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // TODO: Fetch default bron or let user select
  const bronId = null; // Will be set when we have brons

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !bronId) return;

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
        setCurrentRunId(run.id);
        setPrompt('');
      }
    } catch (error) {
      console.error('Failed to create run:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      {/* Hero Section when no run */}
      {!currentRunId && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="heading-serif text-5xl md:text-6xl mb-4 text-gradient-warm">
              Bron
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Deploy your AI agents to handle complex tasks. Search emails, extract data,
              draft responses — all with human approval at critical steps.
            </p>
          </div>

          {/* Command Input */}
          <div className="w-full max-w-2xl">
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <div className="glass-card rounded-2xl p-1.5 glow-primary">
                  <Textarea
                    placeholder={
                      bronId
                        ? "Describe your task..."
                        : "Create an agent first to begin..."
                    }
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    disabled={!bronId}
                    className={cn(
                      'w-full resize-none rounded-xl border-0 bg-muted/30 px-5 py-4',
                      'text-base placeholder:text-muted-foreground/50',
                      'focus:ring-0 focus:outline-none focus-visible:ring-0',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  />
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <kbd className="px-2 py-1 rounded bg-muted/50 border border-border/50">
                        ⌘
                      </kbd>
                      <kbd className="px-2 py-1 rounded bg-muted/50 border border-border/50">
                        Enter
                      </kbd>
                      <span>to send</span>
                    </div>
                    <Button
                      type="submit"
                      disabled={!prompt.trim() || !bronId || isSubmitting}
                      className="rounded-xl px-6"
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
                  </div>
                </div>
              </div>
            </form>

            {!bronId && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                <a href="/brons" className="text-primary hover:underline">
                  Create your first agent
                </a>{' '}
                to get started
              </p>
            )}
          </div>

          {/* Example Tasks */}
          <div className="w-full max-w-3xl mt-16">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 text-center">
              Example Tasks
            </h3>
            <div className="grid gap-3 md:grid-cols-3 stagger-fade-in">
              <ExampleTask
                title="Invoice Extraction"
                text="Find the latest invoice from Acme Corp and extract the total amount"
                icon="📄"
                onSelect={setPrompt}
                disabled={!bronId}
              />
              <ExampleTask
                title="Email Search"
                text="Search for emails from John about the Q4 project update"
                icon="🔍"
                onSelect={setPrompt}
                disabled={!bronId}
              />
              <ExampleTask
                title="Draft Response"
                text="Draft a follow-up email about the meeting notes from yesterday"
                icon="✉️"
                onSelect={setPrompt}
                disabled={!bronId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Run Progress View */}
      {currentRunId && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] py-6">
          {/* Timeline */}
          <div className="glass-card rounded-2xl p-6 min-h-[600px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="heading-serif text-2xl">Run Progress</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Real-time updates from your agent
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="status-dot running h-2.5 w-2.5" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
            </div>
            <ScrollArea className="h-[500px] pr-4">
              <RunTimeline runId={currentRunId} />
            </ScrollArea>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* New Task */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-medium mb-4">New Task</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Textarea
                  placeholder="Describe your next task..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  disabled={!bronId}
                  className="resize-none rounded-xl border-border/50 bg-muted/30 focus-visible:ring-primary/50"
                />
                <Button
                  type="submit"
                  className="w-full rounded-xl"
                  disabled={!prompt.trim() || !bronId || isSubmitting}
                >
                  {isSubmitting ? 'Launching...' : 'Launch'}
                </Button>
              </form>
            </div>

            {/* Quick Actions */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-medium mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setCurrentRunId(null)}
                  className="w-full text-left text-sm p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  ← Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExampleTask({
  title,
  text,
  icon,
  onSelect,
  disabled,
}: {
  title: string;
  text: string;
  icon: string;
  onSelect: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(text)}
      disabled={disabled}
      className={cn(
        'w-full text-left p-5 rounded-xl border border-border/50',
        'bg-card/50 hover:bg-card hover:border-primary/30',
        'transition-all duration-200 card-hover',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card/50 disabled:hover:border-border/50 disabled:hover:transform-none'
      )}
    >
      <div className="text-2xl mb-3">{icon}</div>
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">{text}</p>
    </button>
  );
}
