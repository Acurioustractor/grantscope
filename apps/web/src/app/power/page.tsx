import { Suspense } from 'react';
import { PowerPageClient } from './client';

export default function PowerPage() {
  return (
    <Suspense>
      <PowerPageClient />
    </Suspense>
  );
}
