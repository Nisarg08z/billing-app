import { MongoClient } from 'mongodb';

// One connection pool per server process. In dev, keep it on globalThis so hot reloads don't open new pools.
const g = globalThis;

export async function getDb() {
  if (!g._bsDb) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set. Add it to .env.local (see .env.example).');
    g._bsDb = (async () => {
      const client = new MongoClient(uri, { maxPoolSize: 10 });
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || 'bapa_sitaram');
      await Promise.all([
        db.collection('bills').createIndex({ id: 1 }, { unique: true }),
        db.collection('bills').createIndex({ time: -1 }),
      ]);
      return db;
    })().catch(e => { g._bsDb = null; throw e; });
  }
  return g._bsDb;
}
