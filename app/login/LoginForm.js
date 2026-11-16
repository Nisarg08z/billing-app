'use client';
import { useState } from 'react';

export default function LoginForm() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!pw) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      if (r.ok) { location.replace('/'); return; }
      setErr((await r.json().catch(() => ({}))).error || 'Could not sign in');
    } catch { setErr('No internet connection'); }
    setBusy(false);
  }
  return (
    <form className="card pad" onSubmit={submit}>
      <input type="password" placeholder="Password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} autoFocus aria-label="Password" />
      <button className="btn gold" disabled={busy || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <div className="err" role="alert">{err}</div>
    </form>
  );
}
