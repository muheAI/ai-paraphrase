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
    return res.status(500).json({ error: "❌环境变量API_KEY为空" });
  }

  try {
    // 这里填你截图上那串OpenAI‑compatible地址，结尾带上 /chat/completions
    const baseUrl = "https://ws‑67aou7vzfo495m82.cn‑beijing.maas.aliyuncs.com/compatible‑mode/v1/chat/completions";

    const resp = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content‑Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "qwen‑plus",
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
      console.error("API返回错误", data);
      return res.status(500).json({ error: "服务器异常，请稍后再试" });
    }

    const result = data?.choices?.[0]?.message?.content || "";
    res.status(200).json({ result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "服务器异常，请稍后再试" });
  }
}

