import { guard } from '@/lib/auth';
import { createBill, getBills } from '@/lib/data';

export async function GET(req) {
  const denied = await guard(); if (denied) return denied;
  const p = req.nextUrl.searchParams;
  return Response.json(await getBills(p.get('from'), p.get('to')));
}

// Saves the bill and clears that table's running order
export async function POST(req) {
  const denied = await guard(); if (denied) return denied;
  const { bill } = await req.json();
  try { return Response.json(await createBill(bill)); }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
