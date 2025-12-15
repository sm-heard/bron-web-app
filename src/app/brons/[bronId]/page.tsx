import { BronDetail } from '@/components/bron-detail';

interface Props {
  params: Promise<{ bronId: string }>;
}

export default async function BronDetailPage({ params }: Props) {
  const { bronId } = await params;

  return (
    <div className="container py-6">
      <BronDetail bronId={bronId} />
    </div>
  );
}
