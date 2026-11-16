import { getDb } from './mongo';

/* MongoDB layout
   config  { _id: 'main', settings, cats, menu, tables, seq }   restaurant details, menu, table list, last bill number
   orders  { _id: <table name>, order }                          one running order per table
   bills   { id, time, table, pay, items, sub, discPct, d, gstPct, tax, total, void? }  */

export const DEFAULT_SETTINGS = {
  name: 'Bapa Sitaram Restaurant', addr: 'Dhrangadhra, Gujarat', phone: '92653 09136',
  gstin: '', gst: 0, upi: '', footer: 'Thank you! Visit again.',
};
const DEFAULT_CONFIG = { settings: DEFAULT_SETTINGS, cats: [], menu: [], tables: [], seq: 0 };
// Takeaway orders are not tables: each one is a running order named 'Takeaway 1', 'Takeaway 2', …
export const isTakeaway = name => /^Takeaway( \d+)?$/i.test(String(name));

const num = v => Math.max(0, Number(v) || 0);
const str = (v, max = 200) => String(v ?? '').slice(0, max);
const strip = ({ _id, ...rest }) => rest;

export function cleanConfig(c) {
  const s = c?.settings || {};
  const settings = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) settings[k] = k === 'gst' ? num(s[k]) : str(s[k] ?? DEFAULT_SETTINGS[k], 300);
  const menu = (Array.isArray(c?.menu) ? c.menu : []).slice(0, 2000)
    .map(m => ({ id: Number(m.id) || Date.now(), name: str(m.name), price: num(m.price), cat: str(m.cat || 'General', 100) }));
  const cats = [...new Set((Array.isArray(c?.cats) ? c.cats : []).map(x => str(x, 100)).filter(Boolean))];
  const tables = [...new Set((Array.isArray(c?.tables) ? c.tables : []).map(x => str(x, 100)).filter(x => x && !isTakeaway(x)))];
  return { settings, cats, menu, tables };
}

export function cleanOrder(o) {
  if (!o || typeof o !== 'object') return null;
  const items = {};
  for (const [id, q] of Object.entries(o.items || {})) { const n = Math.floor(num(q)); if (n > 0) items[str(id, 40)] = n; }
  if (!Object.keys(items).length) return null;
  const out = { items, disc: Math.min(num(o.disc), 100) };
  if (o.gst !== undefined) out.gst = num(o.gst);
  if (o.pay) out.pay = str(o.pay, 20);
  if (o.openedAt) out.openedAt = Number(o.openedAt) || Date.now();
  return out;
}

function cleanBill(b) {
  return {
    time: Number(b.time) || Date.now(), table: str(b.table, 100), pay: str(b.pay || 'Cash', 20),
    items: (Array.isArray(b.items) ? b.items : []).map(i => ({ name: str(i.name), price: num(i.price), qty: Math.floor(num(i.qty)) })),
    sub: num(b.sub), discPct: num(b.discPct), d: num(b.d), gstPct: num(b.gstPct), tax: num(b.tax), total: num(b.total),
    ...(b.void ? { void: true } : {}),
  };
}

export async function getConfig() {
  const db = await getDb();
  const c = await db.collection('config').findOne({ _id: 'main' });
  const cfg = { ...DEFAULT_CONFIG, ...(c ? strip(c) : {}), settings: { ...DEFAULT_SETTINGS, ...(c?.settings || {}) } };
  cfg.tables = (cfg.tables || []).filter(t => !isTakeaway(t)); // the old built-in 'Takeaway' table
  return cfg;
}

export async function getOrders() {
  const db = await getDb();
  const rows = await db.collection('orders').find().toArray();
  return Object.fromEntries(rows.map(r => [r._id, r.order]));
}

export async function getBills(from, to) {
  const db = await getDb();
  const q = { time: { $gte: Number(from) || 0, ...(to ? { $lt: Number(to) } : {}) } };
  return (await db.collection('bills').find(q, { projection: { _id: 0 } }).sort({ time: 1 }).toArray());
}

export async function getState(from, to) {
  const [config, orders, bills, qr] = await Promise.all([getConfig(), getOrders(), getBills(from, to), getQrVersion()]);
  const { seq, ...rest } = config;
  return { ...rest, orders, bills, qr };
}

/* UPI QR code image: images collection, _id 'upi-qr' { data: Binary, type, v }. v changes on every upload,
   so phones load /api/qr?v=<v> and can keep the image cached until it changes. */
export async function getQrVersion() {
  const db = await getDb();
  const d = await db.collection('images').findOne({ _id: 'upi-qr' }, { projection: { v: 1 } });
  return d?.v || null;
}

export async function getQr() {
  const db = await getDb();
  return db.collection('images').findOne({ _id: 'upi-qr' });
}

export async function saveQr(buffer, type) {
  const db = await getDb();
  const v = Date.now();
  await db.collection('images').replaceOne({ _id: 'upi-qr' }, { data: buffer, type, v }, { upsert: true });
  return v;
}

export async function deleteQr() {
  const db = await getDb();
  await db.collection('images').deleteOne({ _id: 'upi-qr' });
}

export async function saveConfig(body) {
  const db = await getDb();
  const c = cleanConfig(body);
  await db.collection('config').updateOne({ _id: 'main' }, { $set: c }, { upsert: true });
}

export async function patchOrders({ set = {}, unset = [] }) {
  const db = await getDb();
  const ops = [];
  for (const [t, o] of Object.entries(set)) {
    const order = cleanOrder(o);
    ops.push(order
      ? { replaceOne: { filter: { _id: str(t, 100) }, replacement: { order }, upsert: true } }
      : { deleteOne: { filter: { _id: str(t, 100) } } });
  }
  for (const t of unset) ops.push({ deleteOne: { filter: { _id: str(t, 100) } } });
  if (ops.length) await db.collection('orders').bulkWrite(ops, { ordered: true });
}

// Bill numbers come from one counter on the server, so two phones never print the same number
export async function createBill(b) {
  const db = await getDb();
  const bill = cleanBill(b);
  if (!bill.items.length) throw new Error('Bill has no items');
  const c = await db.collection('config').findOneAndUpdate({ _id: 'main' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  bill.id = c.seq;
  await db.collection('bills').insertOne({ ...bill });
  await db.collection('orders').deleteOne({ _id: bill.table });
  return bill;
}

export async function voidBill(id) {
  const db = await getDb();
  const r = await db.collection('bills').updateOne({ id: Number(id) }, { $set: { void: true } });
  return r.matchedCount > 0;
}
