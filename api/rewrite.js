export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;
  const MAX_CHAR = 5000;

  if (!text || text.length > MAX_CHAR) {
    return res.status(400).json({ error: "文本为空或者字符超出上限5000" });
  }

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_API_URL = process.env.LLM_API_URL;
  if (!LLM_API_KEY || !LLM_API_URL) {
    return res.status(500).json({ error: "服务端缺少环境变量" });
  }

  try {
    const fetchRes = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: "qwen-turbo",
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

    return res.status(200).json({ result: content, remain: 3 });

  } catch (err) {
    return res.status(500).json({ error: "服务器异常：" + err.message });
  }
}
