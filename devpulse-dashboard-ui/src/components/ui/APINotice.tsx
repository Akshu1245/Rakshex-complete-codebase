'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function APINotice() {
  const [failure, setFailure] = useState<{message: string; status: number} | null>(null);
  useEffect(() => {
    const onFailure = (event: Event) => setFailure((event as CustomEvent).detail);
    window.addEventListener('devpulse-api-error', onFailure);
    return () => window.removeEventListener('devpulse-api-error', onFailure);
  }, []);
  if (!failure) return null;
  return <div role="alert" className="fixed bottom-4 right-4 z-50 max-w-md border border-amber-500/40 bg-zinc-900 p-4 rounded-xl text-sm shadow-lg">
    <p>{failure.status === 401 ? 'Sign in to access your account data.' : failure.message}</p>
    {failure.status === 401 && <Link href="/login" className="text-violet-300 inline-block mt-2">Sign in</Link>}
    <button aria-label="Dismiss notification" className="ml-4 text-zinc-400" onClick={() => setFailure(null)}>Dismiss</button>
  </div>;
}
