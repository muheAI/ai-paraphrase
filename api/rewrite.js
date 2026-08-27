export const config = {
  runtime: "nodejs",
  maxDuration: 30
};

const ipMinuteRecord = new Map();
const RATE_LIMIT_MINUTE = 5;
const MS_ONE_MINUTE = 60 * 1000;

async function fetchWithRetry(url, options, retries) {
  retries = retries || 1;
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res) return res;
    } catch (e) {
      lastErr = e;
      await new Promise(function(r) { setTimeout(r, 800); });
    }
  }
  throw lastErr;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();

  if (!ipMinuteRecord.has(ip)) {
    ipMinuteRecord.set(ip, { countMin: 0, tsMin: now });
  }
  const rec = ipMinuteRecord.get(ip);

  if (now - rec.tsMin > MS_ONE_MINUTE) {
    rec.countMin = 0;
    rec.tsMin = now;
  }

  if (rec.countMin >= RATE_LIMIT_MINUTE) {
    return res.status(429).json({ error: "请求过于频繁，请稍后重试" });
  }
  rec.countMin += 1;
  ipMinuteRecord.set(ip, rec);

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = body ? JSON.parse(body) : {};
    } catch (e) {
      return res.status(400).json({ error: "请求格式错误" });
    }
  }

  const text = body ? body.text : "";
  const MAX_CHAR = 3000;
  if (!text || typeof text !== "string" || text.length > MAX_CHAR) {
    return res.status(400).json({ error: "文本不能为空，最大3000字符" });
  }

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_API_URL = process.env.LLM_API_URL;
  if (!LLM_API_KEY || !LLM_API_URL) {
    return res.status(500).json({ error: "服务暂时不可用" });
  }

  const payload = {
    model: "qwen-turbo",
   messages: [{
  role: "user",
  content: `对下面原文做高质量改写润色，提升表达质感，措辞得体高级，理顺逻辑，完整保留全部原意，不编造新增内容。直接输出改写后的成品文字，不要任何解释、开场白。
原文：${text}`
}]


  let fetchRes;
  try {
    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, 28000);
    fetchRes = await fetchWithRetry(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + LLM_API_KEY
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    }, 1);
    clearTimeout(timer);
  } catch (err) {
    return res.status(503).json({ error: "网络错误，请再试一次。" });
  }

  if (!fetchRes.ok) {
    return res.status(fetchRes.status).json({ error: "AI服务暂时异常，请稍后再试" });
  }

  let data;
  try {
    data = await fetchRes.json();
  } catch (e) {
    return res.status(500).json({ error: "解析响应失败" });
  }

  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) {
    return res.status(500).json({ error: "AI未生成有效内容" });
  }

  return res.status(200).json({ result: content });
}

