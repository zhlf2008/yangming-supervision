// Supabase Configuration
// 使用说明：初始化 Supabase 连接
// ⚠️ service_role 操作已移至 Edge Function: supabase/functions/admin-user
//    部署命令: supabase functions deploy admin-user

const SUPABASE_URL = 'https://whvjfurrkusdwujjodwc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EpIHYcBxeuhS4eCHGaUk9w_ZVYN1Jn_';

// 导出配置供其他模块使用（使用 window 全局变量）
window.supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};

// ---- 基础工具 ----

// 检测是否已登录
function isLoggedIn() {
  return !!localStorage.getItem('supabase_session');
}

// 获取当前用户信息
function getCurrentUser() {
  var userData = localStorage.getItem('supabase_user');
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
  var startTime = Date.now();
  while (!window.db && Date.now() - startTime < 10000) {
    await new Promise(function (r) { setTimeout(r, 100); });
  }
  if (!window.db) {
    throw new Error('Supabase db not initialized');
  }
}

// ---- 动态加载 Supabase JS SDK ----

(function loadSupabase() {
  if (window.db || window.supabaseLoading) return;
  window.supabaseLoading = true;

  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = function () {
    var createClient = window.supabase.createClient;

    // 客户端（anon key）
    var client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = client;

    // 统一 db 对象
    window.db = {
      from: function (table) { return client.from(table); }
    };
  };
  document.head.appendChild(script);
})();
