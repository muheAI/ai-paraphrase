export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({error:"仅支持POST"}),{status:405});
  }
  const { text } = await req.json();
  const MAX_CHAR = 5000;
  if (!text || text.length>MAX_CHAR){
    return Response.json({error:"文本为空或者字符超出上限5000"},{status:400});
  }

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_API_URL = process.env.LLM_API_URL;
  if (!LLM_API_KEY||!LLM_API_URL){
    return Response.json({error:"服务端缺少环境变量"},{status:500});
  }

  const payload={
    model:"qwen-turbo",
    messages:[{role:"user",content:`对下面文本做改写润色：${text}`}]
  };

  const fetchRes=await fetch(LLM_API_URL,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${LLM_API_KEY}`
    },
    body:JSON.stringify(payload)
  });

  if(!fetchRes.ok){
    return Response.json({error:`LLM接口错误 ${fetchRes.status}`},{status:fetchRes.status});
  }
  const data=await fetchRes.json();
  const content=data?.choices?.[0]?.message?.content;
  if(!content){
    return Response.json({error:"模型没有返回内容"},{status:500});
  }
  return Response.json({result:content,remain:3});
}
