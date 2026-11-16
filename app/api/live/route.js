import { guard } from '@/lib/auth';
import { getDb } from '@/lib/mongo';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* Live updates (Server-Sent Events).
   Each open phone keeps this request open. A MongoDB change stream tells us the moment any phone changes the
   menu, tables, orders, bills or QR code, and we send one short message; the phone then fetches the new state.
   The stream ends after 4 minutes (serverless time limits) and the browser reconnects by itself. */
const COLLECTIONS = ['config', 'orders', 'bills', 'images'];

export async function GET(req) {
  const denied = await guard(); if (denied) return denied;
  const db = await getDb();
  const enc = new TextEncoder();
  let changes = null, ping = null, timer = null, closed = false;

  const stop = () => {
    if (closed) return;
    closed = true;
    clearInterval(ping); clearTimeout(timer);
    changes?.close().catch(() => {});
  };

  const body = new ReadableStream({
    start(ctrl) {
      const send = s => { if (!closed) try { ctrl.enqueue(enc.encode(s)); } catch { stop(); } };
      const end = () => { stop(); try { ctrl.close(); } catch {} };
      send('retry: 1500\n\n: connected\n\n');
      try {
        changes = db.watch(
          [{ $match: { 'ns.coll': { $in: COLLECTIONS } } }, { $project: { 'ns.coll': 1, operationType: 1 } }],
          { fullDocument: 'default' },
        );
        changes.on('change', ch => send(`data: ${ch.ns?.coll || 'change'}\n\n`));
        changes.on('error', e => { console.error('live stream', e.message); send('event: fail\ndata: stream\n\n'); end(); });
      } catch (e) {
        console.error('live stream', e.message);
        send('event: fail\ndata: unsupported\n\n'); end(); return;
      }
      ping = setInterval(() => send(': ping\n\n'), 25000); // keeps proxies from closing an idle connection
      timer = setTimeout(end, 240000);
      req.signal.addEventListener('abort', end);
    },
    cancel: stop,
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
