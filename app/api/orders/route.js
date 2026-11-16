import { guard } from '@/lib/auth';
import { patchOrders } from '@/lib/data';

// { set: { "Table 1": order }, unset: ["Table 2"] }
export async function PATCH(req) {
  const denied = await guard(); if (denied) return denied;
  await patchOrders(await req.json());
  return Response.json({ ok: true });
}
