export const config = {
  runtime: "edge"
};

const ipMinuteRecord = new Map();
const RATE_LIMIT_MINUTE = 5;
const MS_ONE_MINUTE = 60 * 1000;

async function fetchWithRetry(url, options, retries = 1) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res) return res;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
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
    return Response.json({ error: "请求过于频繁，请稍后重试" }, { status: 429 });
  }
  rec.countMin += 1;
  ipMinuteRecord.set(ip, rec);

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { text } = body;
  const MAX_CHAR = 3000;
  if (!text || typeof text !== "string" || text.length > MAX_CHAR) {
    return Response.json({ error: "文本不能为空，最大3000字符" }, { status: 400 });
  }

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_API_URL = process.env.LLM_API_URL;
  if (!LLM_API_KEY || !LLM_API_URL) {
    return Response.json({ error: "服务暂时不可用" }, { status: 500 });
  }

  const payload = {
    model: "qwen-turbo",
    messages: [{ role: "user", content: `Paraphrase and rewrite this text: ${text}` }]
  };

  let fetchRes;
  try {
    fetchRes = await fetchWithRetry(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(28000)
    }, 1);
  } catch (err) {
    return Response.json({ error: "网络错误，请再试一次。" }, { status: 503 });
  }

  if (!fetchRes.ok) {
    return Response.json({ error: "AI服务暂时异常，请稍后再试" }, { status: fetchRes.status });
  }

  let data;
  try {
    data = await fetchRes.json();
  } catch (e) {
    return Response.json({ error: "解析响应失败" }, { status: 500 });
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "AI未生成有效内容" }, { status: 500 });
  }

  return Response.json({ result: content });
}
