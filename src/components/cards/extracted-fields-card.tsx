import { cn } from '@/lib/utils';
import type { ExtractedFieldsPayload } from '@/types/db';

interface Props {
  payload: ExtractedFieldsPayload;
}

export function ExtractedFieldsCard({ payload }: Props) {
  const hasConfidence = payload.fields.some((f) => f.confidence !== undefined);

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[oklch(0.70_0.15_280/0.2)] flex items-center justify-center">
            <span className="text-sm">📊</span>
          </div>
          <div>
            <h4 className="font-medium text-sm">Extracted Data</h4>
            <p className="text-xs text-muted-foreground font-mono truncate max-w-[250px]">
              {payload.source}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {payload.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No fields extracted
          </p>
        ) : (
          <div className="space-y-2">
            {payload.fields.map((field, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl',
                  'border border-border/50 bg-muted/20'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">{field.key}</p>
                  <p className="text-sm font-medium truncate">{field.value}</p>
                </div>
                {hasConfidence && field.confidence !== undefined && (
                  <ConfidenceBadge value={field.confidence} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const percentage = Math.round(value * 100);

  const getConfig = () => {
    if (percentage >= 90) return { bg: 'bg-[oklch(0.70_0.18_145/0.2)]', text: 'text-[oklch(0.80_0.15_145)]' };
    if (percentage >= 70) return { bg: 'bg-[oklch(0.70_0.16_85/0.2)]', text: 'text-[oklch(0.80_0.14_85)]' };
    return { bg: 'bg-[oklch(0.65_0.18_25/0.2)]', text: 'text-[oklch(0.80_0.15_25)]' };
  };

  const config = getConfig();

  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-lg text-xs font-medium',
        config.bg,
        config.text
      )}
    >
      {percentage}%
    </span>
  );
}
