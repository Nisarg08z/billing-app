import { guard } from '@/lib/auth';
import { voidBill } from '@/lib/data';

// Cancel a bill (it stays in the list, marked cancelled)
export async function PATCH(req, { params }) {
  const denied = await guard(); if (denied) return denied;
  const { id } = await params;
  return (await voidBill(id)) ? Response.json({ ok: true }) : Response.json({ error: 'Bill not found' }, { status: 404 });
}
