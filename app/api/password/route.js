import { guard, passwordOk, sessionCookie, sessionToken, setPassword } from '@/lib/auth';

// Change the sign-in password. This phone stays signed in; every other phone has to sign in again.
export async function POST(req) {
  const denied = await guard(); if (denied) return denied;
  const { current, next } = await req.json().catch(() => ({}));
  if (!(await passwordOk(current))) {
    await new Promise(r => setTimeout(r, 700));
    return Response.json({ error: 'Current password is wrong' }, { status: 400 });
  }
  if (typeof next !== 'string' || next.length < 4) return Response.json({ error: 'New password must be at least 4 characters' }, { status: 400 });
  if (next.length > 200) return Response.json({ error: 'New password is too long' }, { status: 400 });
  await setPassword(next);
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', sessionCookie(await sessionToken()));
  return res;
}
