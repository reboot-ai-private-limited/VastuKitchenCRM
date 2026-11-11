'use client';

import { useParams } from 'next/navigation';
import { ComplaintDetail } from '@/components/complaints/complaint-detail';

export default function ComplaintPage() {
  const { id } = useParams<{ id: string }>();
  return <ComplaintDetail id={id} />;
}
