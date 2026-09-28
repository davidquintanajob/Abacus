'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function EntradaFormRedirect() {
  const router = useRouter();
  
  React.useEffect(() => {
    // Redirect to the add form with a placeholder ID
    router.push('/entradas/form/add?mode=add');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  );
}
