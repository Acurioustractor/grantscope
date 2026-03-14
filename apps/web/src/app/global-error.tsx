'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
