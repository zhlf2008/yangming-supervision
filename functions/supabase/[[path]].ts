// Supabase API 反向代理
// 拦截 /supabase/* 请求，转发到真正的 Supabase 后端

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, X-Client-Info',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      },
    });
  }

  // 去掉 /supabase 前缀，拼出真正的 Supabase URL
  const targetPath = url.pathname.replace('/supabase', '');
  const targetUrl = `https://whvjfurrkusdwujjodwc.supabase.co${targetPath}${url.search}`;

  const proxyResp = await fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  // 添加 CORS 头
  const resp = new Response(proxyResp.body, proxyResp);
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, apikey, X-Client-Info');
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');

  return resp;
}
