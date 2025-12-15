import { RunDetail } from '@/components/run-detail';

interface Props {
  params: Promise<{ runId: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { runId } = await params;

  return (
    <div className="container py-6">
      <RunDetail runId={runId} />
    </div>
  );
}
