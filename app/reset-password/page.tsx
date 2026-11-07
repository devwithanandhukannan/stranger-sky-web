'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has('mode')) {
      params.set('mode', 'resetPassword');
    }
    router.replace(`/auth/action?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="login-loading">
      <div className="login-spinner" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="login-loading">
          <div className="login-spinner" />
        </div>
      }
    >
      <ResetPasswordRedirect />
    </Suspense>
  );
}

