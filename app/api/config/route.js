import { guard } from '@/lib/auth';
import { saveConfig } from '@/lib/data';

export async function PUT(req) {
  const denied = await guard(); if (denied) return denied;
  await saveConfig(await req.json());
  return Response.json({ ok: true });
}
