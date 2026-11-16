import { guard } from '@/lib/auth';
import { deleteQr, getQr, saveQr } from '@/lib/data';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX = 1.5 * 1024 * 1024;

// The QR image. The URL carries ?v=<version>, so the browser can keep it until a new one is uploaded.
export async function GET() {
  const denied = await guard(); if (denied) return denied;
  const qr = await getQr();
  if (!qr) return new Response('No QR code', { status: 404 });
  return new Response(qr.data.buffer, {
    headers: { 'Content-Type': qr.type, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}

// Upload: { image: "data:image/png;base64,..." }
export async function PUT(req) {
  const denied = await guard(); if (denied) return denied;
  const { image } = await req.json().catch(() => ({}));
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(image || ''));
  if (!m || !TYPES.includes(m[1])) return Response.json({ error: 'Choose a PNG or JPG image' }, { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX) return Response.json({ error: 'Image is too large' }, { status: 400 });
  return Response.json({ v: await saveQr(buf, m[1]) });
}

export async function DELETE() {
  const denied = await guard(); if (denied) return denied;
  await deleteQr();
  return Response.json({ ok: true });
}
