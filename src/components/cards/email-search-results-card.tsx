import { cn } from '@/lib/utils';
import type { EmailSearchResultsPayload } from '@/types/db';

interface Props {
  payload: EmailSearchResultsPayload;
}

export function EmailSearchResultsCard({ payload }: Props) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[oklch(0.70_0.15_220/0.2)] flex items-center justify-center">
            <span className="text-sm">🔍</span>
          </div>
          <div>
            <h4 className="font-medium text-sm">Search Results</h4>
            <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
              {payload.query}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {payload.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No matching emails found
          </p>
        ) : (
          <div className="space-y-3">
            {payload.matches.map((match, index) => (
              <div
                key={match.messageId}
                className={cn(
                  'p-4 rounded-xl border border-border/50 bg-muted/20',
                  'hover:bg-muted/30 transition-colors'
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h5 className="font-medium text-sm line-clamp-1">{match.subject}</h5>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {match.date}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  From: {match.from}
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[oklch(0.70_0.15_220/0.15)] text-[oklch(0.80_0.12_220)] text-xs">
                  <span className="status-dot success h-1.5 w-1.5" />
                  {match.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
