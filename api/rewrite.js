export const config = {
  runtime: "edge"
};

// Edge内存限流，实例重启会重置；必须搭配阿里云控制台设置每日额度上限做兜底
const ipRecord = new Map();
const RATE_LIMIT_MINUTE = 2;    // 同一个IP，1分钟最多2次请求
const RATE_LIMIT_DAY = 3;       // 同一个IP，单日最多3次，和页面剩余次数对齐
const MS_ONE_MINUTE = 60 * 1000;
const MS_ONE_DAY = 24 * 60 * 60 * 1000;

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers:{"Content‑Type":"application/json"} });
  }

  // 获取访问者真实IP（Vercel Edge环境）
  const ip = req.headers.get("x‑forwarded‑for") || "unknown";
  const now = Date.now();

  // IP限流逻辑
  if (!ipRecord.has(ip)) {
    ipRecord.set(ip, { countMin:0, tsMin:now, countDay:0, tsDay:now });
  }
  const rec = ipRecord.get(ip);

  // 重置一分钟窗口
  if (now - rec.tsMin > MS_ONE_MINUTE) {
    rec.countMin = 0;
    rec.tsMin = now;
  }
  // 重置单日窗口
  if (now - rec.tsDay > MS_ONE_DAY) {
    rec.countDay = 0;
    rec.tsDay = now;
  }

  if (rec.countMin >= RATE_LIMIT_MINUTE) {
    return Response.json({ error: "请求过于频繁，请稍后重试" }, { status:429 });
  }
  if (rec.countDay >= RATE_LIMIT_DAY) {
    return Response.json({ error: "今日使用次数已耗尽，请明天再来" }, { status:429 });
  }

  rec.countMin += 1;
  rec.countDay += 1;
  ipRecord.set(ip, rec);

  let body;
  try {
    body = await req.json();
  } catch(e) {
    return Response.json({ error:"请求格式错误" },{status:400});
  }

  const { text } = body;
  const MAX_CHAR = 5000;
  if (!text || typeof text !== "string" || text.length > MAX_CHAR) {
    return Response.json({ error:"文本不能为空且不能超过5000字符" },{status:400});
  }

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_API_URL = process.env.LLM_API_URL;
  if (!LLM_API_KEY || !LLM_API_URL) {
    return Response.json({ error:"服务暂时不可用" },{status:500});
  }

  const payload={
    model:"qwen-turbo",
    messages:[{role:"user",content:`对下面文本做改写润色：${text}`}]
  };

  let fetchRes;
  try {
    fetchRes=await fetch(LLM_API_URL,{
      method:"POST",
      headers:{
        "Content‑Type":"application/json",
        "Authorization":`Bearer ${LLM_API_KEY}`
      },
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(25000)
    });
  } catch(err) {
    return Response.json({ error:"模型服务超时，请重试" },{status:503});
  }

  if(!fetchRes.ok){
    // 不把阿里云原始错误对外返回，防止泄露内部信息
    return Response.json({ error:"AI服务暂时异常，请稍后再试" },{status:fetchRes.status});
  }

  let data;
  try{
    data=await fetchRes.json();
  }catch(e){
    return Response.json({ error:"解析响应失败" },{status:500});
  }

  const content=data?.choices?.[0]?.message?.content;
  if(!content){
    return Response.json({ error:"AI未生成有效内容" },{status:500});
  }

  return Response.json({ result:content, remain: RATE_LIMIT_DAY‑rec.countDay });
}
