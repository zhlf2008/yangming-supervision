// Cloudflare Worker — Supabase 反向代理
// 部署到 tuoyue.space，代理 /supabase/* → supabase.co

// 预加载 Supabase SDK
const SDK_URL = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js';
let sdkCache = null;

async function getSupabaseSDK() {
  if (sdkCache) return sdkCache;
  const resp = await fetch(SDK_URL);
  sdkCache = await resp.text();
  return sdkCache;
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ① 返回本地 SDK（绕过被墙的 CDN）
  if (path === '/supabase-sdk/supabase.min.js') {
    const sdk = await getSupabaseSDK();
    return new Response(sdk, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=604800, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // ② 代理 Supabase API
  if (path.startsWith('/supabase/')) {
    const targetPath = path.replace('/supabase', '');
    const targetUrl = 'https://whvjfurrkusdwujjodwc.supabase.co' + targetPath + url.search;

    const proxyResp = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // 复制响应并添加 CORS 头
    const resp = new Response(proxyResp.body, proxyResp);
    resp.headers.set('Access-Control-Allow-Origin', '*');
    resp.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, apikey, X-Client-Info');
    resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    return resp;
  }

  // ③ OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, X-Client-Info',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      },
    });
  }

  // ④ 其余请求转发到 Cloudflare Pages
  return fetch('https://yangming-supervision.pages.dev' + path + url.search, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
}
