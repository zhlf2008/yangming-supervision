// Supabase Configuration
// 使用说明：初始化 Supabase 连接
// ⚠️ service_role 操作已移至 Edge Function: supabase/functions/admin-user
//    部署命令: supabase functions deploy admin-user
//
// 📌 版本号：修改此文件后递增此值（同时也会刷新 utils.js、components.js 的缓存）
var APP_CACHE_VERSION = '7';

const SUPABASE_URL = 'https://whvjfurrkusdwujjodwc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EpIHYcBxeuhS4eCHGaUk9w_ZVYN1Jn_';

// 导出配置供其他模块使用（使用 window 全局变量）
window.supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};

// 检测是否已登录（通过 SDK 原生 getSession）
async function isLoggedIn() {
  if (!window.supabaseClient) return false;
  try {
    var result = await window.supabaseClient.auth.getSession();
    return !!(result.data && result.data.session);
  } catch (e) {
    return false;
  }
}

// 获取当前用户信息
function getCurrentUser() {
  var userData = localStorage.getItem('supabase_user');
  return userData ? JSON.parse(userData) : null;
}

// 清除登录状态
function clearLoginState() {
  localStorage.removeItem('supabase_user');
  localStorage.removeItem('currentUser');
  // 登出 Supabase Auth（SDK 会自动清除标准 key 中的 session）
  if (window.supabaseClient) {
    window.supabaseClient.auth.signOut().catch(function () {});
  }
}

// 页面初始化前等待 db 就绪
async function waitForDb() {
  if (window.db) return;
  var startTime = Date.now();
  while (!window.db && Date.now() - startTime < 20000) {
    if (window.supabaseLoadFailed) break;
    await new Promise(function (r) {
      setTimeout(r, 100);
    });
  }
  if (!window.db) {
    throw new Error('Supabase db not initialized');
  }
}

// ---- 动态加载 Supabase JS SDK ----

(function loadSupabase() {
  if (window.db || window.supabaseLoading) return;
  window.supabaseLoading = true;

  var CDN_LIST = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js'
  ];
  var cdnIndex = 0;

  function tryLoadCdn() {
    if (cdnIndex >= CDN_LIST.length) {
      window.supabaseLoadFailed = true;
      return;
    }
    var script = document.createElement('script');
    script.src = CDN_LIST[cdnIndex];
    script.async = true;
    script.onload = function () {
      initSupabase();
    };
    script.onerror = function () {
      cdnIndex++;
      tryLoadCdn();
    };
    document.head.appendChild(script);
  }

  function initSupabase() {
    var createClient = window.supabase.createClient;

    // 使用 SDK 标准持久化 —— session 自动存入 sb-<ref>-auth-token
    var client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    window.supabaseClient = client;

    // 监听 Auth 状态变化：session 刷新后同步更新 supabase_user
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'TOKEN_REFRESHED' && session) {
        // 从 profiles 拉最新数据更新 localStorage
        client
          .from('profiles')
          .select('*, organizations(*)')
          .eq('id', session.user.id)
          .single()
          .then(function (res) {
            if (res.data) {
              localStorage.setItem('supabase_user', JSON.stringify(res.data));
              localStorage.setItem('currentUser', res.data.name || '');
            }
          })
          .catch(function () {});
      }
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('supabase_user');
        localStorage.removeItem('currentUser');
      }
    });

    // 统一 db 对象（直接透传 Supabase client，不做额外包装）
    window.db = client;
  }

  tryLoadCdn();
})();
