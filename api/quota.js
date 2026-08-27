export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  // 去掉KV数据库，直接返回可用次数
  res.status(200).json({ remain: 3, limit: 3 });
}
