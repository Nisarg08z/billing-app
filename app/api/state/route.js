import { guard } from '@/lib/auth';
import { getState } from '@/lib/data';

// Config, running orders, and the bills between ?from and ?to (ms timestamps)
export async function GET(req) {
  const denied = await guard(); if (denied) return denied;
  const p = req.nextUrl.searchParams;
  return Response.json(await getState(p.get('from') || Date.now() - 36e5 * 30, p.get('to')));
}
