import { cn } from '@/lib/utils';
import type { RunSummaryPayload } from '@/types/db';

interface Props {
  payload: RunSummaryPayload;
}

export function RunSummaryCard({ payload }: Props) {
  const outcomeConfig: Record<string, { borderClass: string; bgClass: string; icon: string; label: string; statusClass: string }> = {
    succeeded: {
      borderClass: 'border-[oklch(0.70_0.18_145)]',
      bgClass: 'bg-[oklch(0.70_0.18_145/0.05)]',
      icon: '✓',
      label: 'Complete',
      statusClass: 'success',
    },
    failed: {
      borderClass: 'border-destructive',
      bgClass: 'bg-destructive/5',
      icon: '✗',
      label: 'Failed',
      statusClass: 'error',
    },
    canceled: {
      borderClass: 'border-muted-foreground',
      bgClass: 'bg-muted/30',
      icon: '−',
      label: 'Canceled',
      statusClass: 'idle',
    },
  };

  const config = outcomeConfig[payload.outcome] || outcomeConfig.canceled;

  return (
    <div
      className={cn(
        'rounded-xl border-2 overflow-hidden',
        config.borderClass,
        config.bgClass
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold',
                payload.outcome === 'succeeded'
                  ? 'bg-[oklch(0.70_0.18_145/0.2)] text-[oklch(0.80_0.15_145)]'
                  : payload.outcome === 'failed'
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {config.icon}
            </div>
            <div>
              <h4 className="font-semibold text-sm">{config.label}</h4>
              <p className="text-xs text-muted-foreground">Run Summary</p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium capitalize',
              payload.outcome === 'succeeded'
                ? 'bg-[oklch(0.70_0.18_145/0.2)] text-[oklch(0.80_0.15_145)]'
                : payload.outcome === 'failed'
                  ? 'bg-destructive/20 text-destructive'
                  : 'bg-muted/50 text-muted-foreground'
            )}
          >
            <span className={cn('status-dot h-1.5 w-1.5', config.statusClass)} />
            {payload.outcome}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {payload.highlights.length > 0 && (
          <div className="space-y-2">
            {payload.highlights.map((highlight, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl',
                  'border border-border/50 bg-muted/20'
                )}
              >
                <span className="w-5 h-5 rounded-md bg-[oklch(0.70_0.18_145/0.2)] text-[oklch(0.80_0.15_145)] flex items-center justify-center text-xs">
                  ✓
                </span>
                <span className="text-sm">{highlight}</span>
              </div>
            ))}
          </div>
        )}

        {payload.sentMessageId && (
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1.5">Sent Message ID</p>
            <p className="text-sm font-mono truncate">{payload.sentMessageId}</p>
          </div>
        )}
      </div>
    </div>
  );
}
