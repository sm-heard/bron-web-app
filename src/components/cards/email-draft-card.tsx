'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EmailDraftPayload } from '@/types/db';

interface Props {
  payload: EmailDraftPayload;
  runId: string;
}

export function EmailDraftCard({ payload, runId }: Props) {
  const [isApproving, setIsApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);

    try {
      const response = await fetch(`/api/runs/${runId}/approve-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve');
      }

      setApproved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border-2 overflow-hidden',
        approved
          ? 'border-[oklch(0.70_0.18_145)] bg-[oklch(0.70_0.18_145/0.05)]'
          : payload.requiresApproval
            ? 'border-primary/50 bg-primary/5'
            : 'border-border/50 bg-card/50'
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-sm">✉️</span>
            </div>
            <h4 className="font-medium text-sm">Email Draft</h4>
          </div>
          {payload.requiresApproval && !approved && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[oklch(0.70_0.16_85/0.2)] text-[oklch(0.85_0.14_85)] text-xs font-medium">
              <span className="status-dot warning h-1.5 w-1.5" />
              Awaiting Approval
            </span>
          )}
          {approved && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[oklch(0.70_0.18_145/0.2)] text-[oklch(0.80_0.15_145)] text-xs font-medium">
              <span className="status-dot success h-1.5 w-1.5" />
              Approved
            </span>
          )}
        </div>
      </div>

      {/* Email Metadata */}
      <div className="px-5 py-4 space-y-2 border-b border-border/50">
        <div className="flex gap-3">
          <span className="text-sm text-muted-foreground w-16 shrink-0">To:</span>
          <span className="text-sm">{payload.to}</span>
        </div>
        {payload.cc.length > 0 && (
          <div className="flex gap-3">
            <span className="text-sm text-muted-foreground w-16 shrink-0">CC:</span>
            <span className="text-sm">{payload.cc.join(', ')}</span>
          </div>
        )}
        <div className="flex gap-3">
          <span className="text-sm text-muted-foreground w-16 shrink-0">Subject:</span>
          <span className="text-sm font-medium">{payload.subject}</span>
        </div>
      </div>

      {/* Email Body */}
      <div className="p-5">
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {payload.bodyText}
          </pre>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {payload.requiresApproval && !approved && (
        <div className="px-5 py-4 border-t border-border/50 bg-muted/20 flex gap-3">
          <Button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex-1 rounded-xl glow-primary"
          >
            {isApproving ? (
              <span className="flex items-center gap-2">
                <span className="status-dot running h-2 w-2" />
                Sending...
              </span>
            ) : (
              'Approve & Send'
            )}
          </Button>
          <Button variant="outline" disabled={isApproving} className="rounded-xl">
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
