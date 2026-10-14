'use client';

import { useRouter } from 'next/navigation';
import { use } from 'react';
import OperacionForm from '../page';

export default function EditOperacionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);

  return <OperacionForm operacionId={resolvedParams.id} />;
}
