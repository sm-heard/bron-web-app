import { cn } from '@/lib/utils';
import type { AttachmentSummaryPayload } from '@/types/db';

interface Props {
  payload: AttachmentSummaryPayload;
}

export function AttachmentSummaryCard({ payload }: Props) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[oklch(0.70_0.15_145/0.2)] flex items-center justify-center">
            <span className="text-sm">📎</span>
          </div>
          <div>
            <h4 className="font-medium text-sm">Attachments</h4>
            <p className="text-xs text-muted-foreground">
              {payload.attachments.length} file{payload.attachments.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {payload.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No attachments found
          </p>
        ) : (
          <div className="space-y-2">
            {payload.attachments.map((attachment) => (
              <div
                key={attachment.attachmentId}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl',
                  'border border-border/50 bg-muted/20',
                  'hover:bg-muted/30 transition-colors'
                )}
              >
                <div className="flex items-center gap-3">
                  <FileIcon mimeType={attachment.mimeType} />
                  <div>
                    <p className="font-medium text-sm truncate max-w-[200px]">
                      {attachment.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(attachment.sizeBytes)}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-muted/50 text-xs text-muted-foreground font-mono">
                  {attachment.mimeType.split('/')[1]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const isPdf = mimeType.includes('pdf');
  const isSpreadsheet = mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv');
  const isImage = mimeType.startsWith('image');

  const getConfig = () => {
    if (isPdf) return { bg: 'bg-[oklch(0.65_0.18_25/0.2)]', text: 'text-[oklch(0.80_0.15_25)]', label: 'PDF' };
    if (isSpreadsheet) return { bg: 'bg-[oklch(0.65_0.18_145/0.2)]', text: 'text-[oklch(0.80_0.15_145)]', label: mimeType.includes('csv') ? 'CSV' : 'XLS' };
    if (isImage) return { bg: 'bg-[oklch(0.65_0.18_280/0.2)]', text: 'text-[oklch(0.80_0.15_280)]', label: 'IMG' };
    return { bg: 'bg-muted/50', text: 'text-muted-foreground', label: 'FILE' };
  };

  const config = getConfig();

  return (
    <div
      className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold',
        config.bg,
        config.text
      )}
    >
      {config.label}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
