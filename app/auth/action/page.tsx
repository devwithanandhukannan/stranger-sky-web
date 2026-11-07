'use client';

import { Suspense } from 'react';
import { AuthActionContent } from '@/components/sky/AuthActionContent';

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <div className="login-loading">
          <div className="login-spinner" />
        </div>
      }
    >
      <AuthActionContent />
    </Suspense>
  );
}
