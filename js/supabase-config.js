// Supabase Configuration
// 使用说明：初始化 Supabase 连接

const SUPABASE_URL = 'https://whvjfurrkusdwujjodwc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EpIHYcBxeuhS4eCHGaUk9w_ZVYN1Jn_';
// ⚠️ SERVICE_ROLE_KEY 有 admin 权限，仅用于删除用户操作，生产环境建议移到 Edge Function
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodmpmdXJya3VzZHd1ampvZHdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc3NDA4MCwiZXhwIjoyMDkyMzUwMDgwfQ.xkSsbr5Gv8F82bhneevGUJ1V0Pq4jB5uPkR3jAVAJKQ';

// 导出配置供其他模块使用（使用 window 全局变量）
window.supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY
};

// 检测是否已登录
function isLoggedIn() {
  return !!localStorage.getItem('supabase_session');
}

// 获取当前用户信息
function getCurrentUser() {
  const userData = localStorage.getItem('supabase_user');
  return userData ? JSON.parse(userData) : null;
}

// 清除登录状态
function clearLoginState() {
  localStorage.removeItem('supabase_session');
  localStorage.removeItem('supabase_user');
}

// 页面初始化前等待 db 就绪
async function waitForDb() {
  if (window.db) return;
  const startTime = Date.now();
  while (!window.db && Date.now() - startTime < 10000) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!window.db) {
    throw new Error('Supabase db not initialized');
  }
}

// 动态加载 Supabase JS SDK
(function loadSupabase() {
  if (window.db || window.supabaseLoading) return;
  window.supabaseLoading = true;

  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = function() {
    const { createClient } = window.supabase;
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    window.supabaseClient = client;
    window.supabaseAdmin = adminClient; // 用于 admin 操作（如删除用户）

    // 完整封装 db 对象，保持与 supabase-js 原生 API 完全兼容
    window.db = {
      from(table) {
        return client.from(table);
      }
    };

  };
  document.head.appendChild(script);
})();
