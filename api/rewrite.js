export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { text } = req.body;
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: '请输入文本' });
  }

  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "服务器异常，请稍后再试" });
  }

  try {
    const resp = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "doubao-pro-4k",
        messages: [
          {
            role: "system",
            content: "你是专业文本改写助手，对用户输入文本做流畅润色改写，只输出改写后的结果，不要多余解释。"
          },
          { role: "user", content: text }
        ],
        temperature: 0.7
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(500).json({ error: "服务器异常，请稍后再试" });
    }

    const result = data?.choices?.[0]?.message?.content || "";
    res.status(200).json({ result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "服务器异常，请稍后再试" });
  }
}


