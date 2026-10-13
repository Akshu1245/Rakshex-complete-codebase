'use client';

import { FormEvent, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setBusy(true);
    try {
      const result = register ? await apiClient.onboardingSignup(email, username, password) : await apiClient.login(email, password);
      if (!result.token) throw new Error('Sign-in did not return a session. Please retry.');
      // Reload data components so results from a previous account cannot remain mounted.
      window.location.assign('/');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sign-in failed');
      setBusy(false);
    }
  }

  return <div className="max-w-md mx-auto py-12">
    <Card>
      <h1 className="text-xl font-semibold mb-2">{register ? 'Create account' : 'Sign in'}</h1>
      <p className="text-sm text-zinc-400 mb-6">Access your scans, cost records, and reports.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">Email
          <input className="block w-full bg-zinc-800 rounded-lg p-3 mt-1" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        {register && <label className="block text-sm">Username
          <input className="block w-full bg-zinc-800 rounded-lg p-3 mt-1" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_-]+" />
        </label>}
        <label className="block text-sm">Password
          <input className="block w-full bg-zinc-800 rounded-lg p-3 mt-1" type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={register ? 8 : 1} maxLength={72} />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">{register ? 'Create account' : 'Sign in'}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => { setRegister(!register); setError(''); }} className="w-full">
          {register ? 'Already registered? Sign in' : 'New here? Create account'}
        </Button>
      </form>
    </Card>
  </div>;
}
