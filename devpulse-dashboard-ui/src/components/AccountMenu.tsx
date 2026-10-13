'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, AuthUser, getAuthToken } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export default function AccountMenu() {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (!getAuthToken()) { if (active) setUser(null); return; }
      try { const result = await apiClient.getMe(); if (active) setUser(result.user || null); }
      catch { if (active) setUser(null); }
    }
    void refresh();
    const changedElsewhere = (event: StorageEvent) => { if (event.key === 'devpulse_token') window.location.reload(); };
    window.addEventListener('devpulse-auth', refresh);
    window.addEventListener('storage', changedElsewhere);
    return () => { active = false; window.removeEventListener('devpulse-auth', refresh); window.removeEventListener('storage', changedElsewhere); };
  }, []);
  if (!user) return <Link href="/login" className="text-sm text-violet-300">Sign in</Link>;
  return <div className="flex items-center gap-2 text-sm">
    <span>{user.username}</span>
    <Button variant="ghost" size="sm" onClick={() => { apiClient.logout(); window.location.assign('/login'); }}>Sign out</Button>
  </div>;
}
