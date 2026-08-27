import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const today = new Date().toISOString().slice(0, 10);
  const key = `limit:${ip}:${today}`;
  let record = await kv.get(key);
  if (!record) {
    record = { count: 0, date: today };
    await kv.set(key, JSON.stringify(record));
  } else {
    record = JSON.parse(record);
  }
  const DAILY_LIMIT = 3;
  const remain = Math.max(0, DAILY_LIMIT - record.count);
  res.status(200).json({ remain, limit: DAILY_LIMIT });
}
