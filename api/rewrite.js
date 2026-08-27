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
    return res.status(500).json({ error: "环境变量API_KEY为空" });
  }

  try {
    // 你的百炼Token‑Plan OpenAI兼容接口地址
    const url = "https://ws-67aou7vzfo495m82.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

    const payload = {
      model: "qwen-plus",
      messages: [
        { role: "system", content: "你是专业改写助手，润色用户文本，只输出改写结果，不要多余话。" },
        { role: "user", content: text }
      ],
      temperature: 0.7
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("ali error", result);
      return res.status(500).json({ error: "服务器异常，请稍后再试" });
    }

    const output = result?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ result: output });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "服务器异常，请稍后再试" });
  }
}

