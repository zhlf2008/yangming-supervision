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

// 页面初始化前等待 db 就绪 + session 恢复
async function waitForDb() {
  if (window.db) return;
  var startTime = Date.now();
  while (!window.db && Date.now() - startTime < 10000) {
    await new Promise(function (r) { setTimeout(r, 100); });
  }
  if (!window.db) {
    throw new Error('Supabase db not initialized');
  }
  // 等待 session 从自定义 localStorage 恢复完成
  if (window._sessionReady) {
    await window._sessionReady;
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

    // 从自定义 localStorage key 恢复 Supabase Auth session
    // Supabase SDK 只认 sb-<ref>-auth-token 标准 key，
    // 而登录页存储在 supabase_session 自定义 key 中，
    // 导致其他页面 auth.uid() 为 NULL，RLS 策略失效
    window._sessionReady = Promise.resolve(); // 默认已就绪
    var customSession = localStorage.getItem('supabase_session');
    if (customSession) {
      try {
        var sessionData = JSON.parse(customSession);
        if (sessionData.access_token && sessionData.refresh_token) {
          window._sessionReady = client.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token
          }).then(function (res) {
            if (res.data && res.data.session) {
              localStorage.setItem('supabase_session', JSON.stringify(res.data.session));
            }
          }).catch(function () {
            // token 过期，清除并跳转登录
            clearLoginState();
            if (window.location.pathname.indexOf('login.html') === -1) {
              window.location.href = 'login.html';
            }
          });
        }
      } catch (e) { /* ignore */ }
    }

    // 统一 db 对象
    window.db = {
      from: function (table) { return client.from(table); }
    };
  };
  document.head.appendChild(script);
})();
