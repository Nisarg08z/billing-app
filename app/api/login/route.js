import { hasPassword, passwordOk, sessionCookie, sessionToken } from '@/lib/auth';

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  if (!(await hasPassword())) return Response.json({ error: 'APP_PASSWORD is not set on the server' }, { status: 500 });
  if (!(await passwordOk(password))) {
    await new Promise(r => setTimeout(r, 700)); // slow down guessing
    return Response.json({ error: 'Wrong password' }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', sessionCookie(await sessionToken()));
  return res;
}
