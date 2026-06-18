// Supabase API 反向代理
// 拦截 /supabase/* 请求，转发到真正的 Supabase 后端
// CORS 使用通配符 *，兼容 SDK 未来新增的任何请求头

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 代理到真正的 Supabase
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
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers', '*');

  return resp;
}
