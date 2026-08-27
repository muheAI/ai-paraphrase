import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;
  const MAX_CHAR = 5000;
  const DAILY_LIMIT = 3;

  if (!text || text.length > MAX_CHAR) {
    return res.status(400).json({ error: "文本为空或者字符超出上限5000" });
  }

  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const today = new Date().toISOString().slice(0, 10);
  const key = `limit:${ip}:${today}`;

  let recordRaw = await kv.get(key);
  let record;
  if (!recordRaw) {
    record = { count: 0, date: today };
  } else {
    record = JSON.parse(recordRaw);
  }

  if (record.count >= DAILY_LIMIT) {
    return res.status(429).json({ error: "今日免费次数已用尽，请联系WhatsApp获取无限额度" });
  }

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_API_URL = process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
  if (!LLM_API_KEY) {
    return res.status(500).json({ error: "服务端缺少API_KEY环境变量" });
  }

  try {
    const fetchRes = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Paraphrase this text: ${text}` }]
      })
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({ error: `LLM接口错误 ${fetchRes.status}` });
    }
    const data = await fetchRes.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: "模型没有返回内容" });
    }

    record.count += 1;
    await kv.set(key, JSON.stringify(record));
    const remain = Math.max(0, DAILY_LIMIT - record.count);
    return res.status(200).json({ result: content, remain });

  } catch (err) {
    return res.status(500).json({ error: "服务器异常：" + err.message });
  }
}
