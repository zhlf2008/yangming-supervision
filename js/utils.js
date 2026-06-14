// ============================================================
// 阳明心学督察管理系统 —— 公共工具函数库
// 所有页面通过 <script src="js/utils.js"></script> 引入
// ============================================================

(function () {
  document.documentElement.style.overflowY = 'scroll';
  // 稳定导航栏位置，防止切换页面时抖动
  document.addEventListener('DOMContentLoaded', function () {
    var navEl = document.querySelector('.bottom-nav');
    if (navEl) {
      navEl.style.transform = 'translateZ(0)';
      navEl.style.willChange = 'transform';
    }
  });
  // 如果 DOM 已经加载完，直接执行
  if (document.readyState !== 'loading') {
    var navEl = document.querySelector('.bottom-nav');
    if (navEl) {
      navEl.style.transform = 'translateZ(0)';
      navEl.style.willChange = 'transform';
    }
  }
})();

// ---- Toast ----

function showToast(msg, options) {
  var toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  // options: number (duration in ms), 'success', 'error', or object { type, duration }
  var type = '';
  var duration = 2000;
  if (typeof options === 'number') {
    duration = options;
  } else if (typeof options === 'string') {
    type = options;
  } else if (options && typeof options === 'object') {
    type = options.type || '';
    duration = options.duration || 2000;
  }

  toast.textContent = msg;
  toast.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () {
    toast.className = '';
  }, duration);
}

// ---- 确认弹窗 ----

function showConfirm(msg) {
  return new Promise(function (resolve) {
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:3000;animation:confirmFadeIn 0.2s;';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:14px;width:calc(100% - 64px);max-width:340px;padding:28px 24px 20px;text-align:left;box-shadow:0 12px 40px rgba(0,0,0,0.25);">' +
      '<div style="font-size:30px;margin-bottom:12px;text-align:center;">⚠️</div>' +
      '<div style="font-size:14px;color:#2D2D2D;margin-bottom:8px;line-height:1.7;">' +
      msg +
      '</div>' +
      '<div style="font-size:12px;color:#E63946;margin-bottom:8px;text-align:center;">此操作不可撤销</div>' +
      '<div style="display:flex;gap:12px;margin-top:20px;">' +
      '<button style="flex:1;padding:11px 0;font-size:14px;border:1px solid #E8E4DF;border-radius:8px;background:#FAFAF8;color:#5C5C5C;cursor:pointer;">取消</button>' +
      '<button style="flex:1;padding:11px 0;font-size:14px;border:none;border-radius:8px;background:#E63946;color:#fff;cursor:pointer;font-weight:500;">确认删除</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var buttons = overlay.querySelectorAll('button');
    buttons[0].onclick = function () {
      overlay.remove();
      resolve(false);
    };
    buttons[1].onclick = function () {
      overlay.remove();
      resolve(true);
    };
  });
}

// ---- HTML 转义（防 XSS） ----

function escapeHtml(text) {
  if (!text) return '';
  var d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
}

// ---- 周日/周x 转换 ----

var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// ---- 组织架构工具 ----

// 递归获取所有子组织（不限级别）
function getAllChildOrgs(parentId, orgs) {
  var children = orgs.filter(function (o) {
    return o.parent_id === parentId;
  });
  var result = [];
  children.forEach(function (c) {
    result.push(c);
    result = result.concat(getAllChildOrgs(c.id, orgs));
  });
  return result;
}

// 递归获取指定组织下的所有小组（仅 level='小组'）
function getAllGroups(orgId, orgs) {
  var org = orgs.find(function (o) {
    return o.id === orgId;
  });
  if (!org) return [];
  if (org.level === '小组') return [org];
  var children = getDirectChildrenOrgs(orgId, orgs);
  var result = [];
  children.forEach(function (c) {
    result = result.concat(getAllGroups(c.id, orgs));
  });
  return result;
}

// 获取直属子组织
function getDirectChildrenOrgs(parentId, orgs) {
  return orgs.filter(function (o) {
    return o.parent_id === parentId;
  });
}

// 构建组织完整路径名称：大班-班级-小组（参数为数组）
function buildOrgPath(orgId, orgs) {
  var org = orgs.find(function (o) {
    return o.id === orgId;
  });
  if (!org) return '';
  var parts = [org.name];
  var pid = org.parent_id;
  while (pid) {
    var parent = orgs.find(function (o) {
      return o.id === pid;
    });
    if (parent) {
      parts.unshift(parent.name);
      pid = parent.parent_id;
    } else break;
  }
  return parts.join(' - ');
}

// 构建组织路径（参数为以 id 为键的对象映射，用于 summary-page）
function buildOrgPathFromMap(orgId, orgsMap) {
  var org = orgsMap[orgId];
  if (!org) return '';
  var parts = [org.name];
  var pid = org.parent_id;
  while (pid) {
    var parent = orgsMap[pid];
    if (parent) {
      parts.unshift(parent.name);
      pid = parent.parent_id;
    } else break;
  }
  return parts.join(' - ');
}

// ---- 权限工具 ----

// 根据角色和用户所属组织，获取其可访问的小组 ID 集合
function getAccessibleGroupIds(role, userOrgId, orgs) {
  var groupIds = new Set();

  if (role === '小组督察' || role === '小组副督察') {
    var myOrg = orgs.find(function (o) {
      return o.id === userOrgId;
    });
    if (myOrg && myOrg.level === '小组') groupIds.add(myOrg.id);
  } else if (role === '班级总督察' || role === '班级副总督察') {
    if (userOrgId) {
      getDirectChildrenOrgs(userOrgId, orgs)
        .filter(function (o) {
          return o.level === '小组';
        })
        .forEach(function (g) {
          groupIds.add(g.id);
        });
    }
  } else if (role === '大班总督' || role === '大班副督') {
    if (userOrgId) {
      getAllChildOrgs(userOrgId, orgs)
        .filter(function (o) {
          return o.level === '小组';
        })
        .forEach(function (g) {
          groupIds.add(g.id);
        });
    }
  } else if (role === '超级管理员' || role === '管理员') {
    orgs
      .filter(function (o) {
        return o.level === '小组';
      })
      .forEach(function (g) {
        groupIds.add(g.id);
      });
  }

  return groupIds;
}

// 根据角色获取上级组织 ID
function getParentOrgId(role, userOrgId, orgs) {
  if (role === '班级总督察' || role === '班级副总督察') {
    return userOrgId; // 班级本身
  }
  if (role === '大班总督' || role === '大班副督') {
    return userOrgId; // 大班本身
  }
  return null;
}

// ---- 用户排序 ----

function sortUsers(users) {
  return users.slice().sort(function (a, b) {
    function roleOrder(r) {
      var order = {
        超级管理员: 0,
        管理员: 1,
        大班总督: 2,
        大班副督: 3,
        班级总督察: 4,
        班级副总督察: 5,
        小组督察: 6,
        小组副督察: 7
      };
      if (order.hasOwnProperty(r)) return order[r];
      return 8;
    }
    var oa = roleOrder(a.role || '');
    var ob = roleOrder(b.role || '');
    if (oa !== ob) return oa - ob;
    return (a.name || '').localeCompare(b.name || '', 'zh-CN');
  });
}

// ---- 退出登录 ----

async function logout() {
  try {
    if (window.supabaseClient && window.supabaseClient.auth) {
      await window.supabaseClient.auth.signOut();
    }
  } catch (e) {}
  localStorage.removeItem('supabase_user');
  localStorage.removeItem('currentUser');
  window.location.replace('login.html');
}

// ---- adminApi（通过 Edge Function 代理管理员操作） ----

var adminApi = {
  _call: async function (action, body) {
    var supabaseUrl = window.supabaseConfig ? window.supabaseConfig.url : '';
    if (!window.supabaseClient || !window.supabaseClient.auth) {
      return { error: 'Supabase Auth 未初始化' };
    }
    var sessionResult = await window.supabaseClient.auth.getSession();
    var token = sessionResult.data && sessionResult.data.session ? sessionResult.data.session.access_token : '';
    if (!token) {
      return { error: '请先登录后再执行该操作' };
    }
    return fetch(supabaseUrl + '/functions/v1/admin-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(Object.assign({ action: action }, body))
    }).then(function (r) {
      return r.json();
    });
  },

  // 删除 Auth 用户
  deleteUser: function (userId) {
    return adminApi._call('deleteUser', { userId: userId });
  },

  // 创建 Auth 用户（管理员代理，不受限流）
  createUser: function (params) {
    return adminApi._call('createUser', params);
  },

  // 创建 Auth 用户并同步 profiles，可选分配模块权限
  createProfileAccount: function (params) {
    return adminApi._call('createProfileAccount', params);
  },

  // 给已有登录账号添加/恢复模块权限
  grantModuleMembership: function (params) {
    return adminApi._call('grantModuleMembership', params);
  },

  // 停用一条模块权限
  disableModuleMembership: function (membershipId) {
    return adminApi._call('disableModuleMembership', { membershipId: membershipId });
  },

  // 更新 Auth 用户（邮箱、密码等）
  updateUser: function (userId, params) {
    return adminApi._call('updateUser', Object.assign({ userId: userId }, params));
  }
};

// 操作日志：写入失败时降级到 localStorage，连接恢复后批量补传
var AUDITLOG_BACKLOG_KEY = '_auditlog_backlog';
var AUDITLOG_FLUSHING = false;

function logAction(action, target, detail, moduleKey) {
  var user = getCurrentUser();
  if (!user || !window.db) return;
  var entry = {
    user_id: user.id,
    user_name: user.name || '',
    action: action,
    target: target || '',
    detail: detail || '',
    module_key: moduleKey || null
  };
  // 异步获取当前学期ID并补充
  getCurrentSemesterId().then(function(semId) {
    if (semId) entry.semester_id = semId;
    // 异步写入，不阻塞主流程
    try {
      window.db.from('audit_logs').insert(entry).then(function () {
        flushAuditBacklog();
      }).catch(function () {
        appendAuditBacklog(entry);
      });
    } catch (e) {
      appendAuditBacklog(entry);
    }
  }).catch(function() {
    // 获取学期失败时仍然写入（不带 semester_id）
    try {
      window.db.from('audit_logs').insert(entry).then(function () {
        flushAuditBacklog();
      }).catch(function () {
        appendAuditBacklog(entry);
      });
    } catch (e) {
      appendAuditBacklog(entry);
    }
  });
}

function appendAuditBacklog(entry) {
  try {
    var backlog = JSON.parse(localStorage.getItem(AUDITLOG_BACKLOG_KEY) || '[]');
    backlog.push(entry);
    // 最多保留 200 条积压，防止撑爆 localStorage
    if (backlog.length > 200) backlog = backlog.slice(-200);
    localStorage.setItem(AUDITLOG_BACKLOG_KEY, JSON.stringify(backlog));
  } catch (e) {
    /* localStorage 也不可用，放弃 */
  }
}

function flushAuditBacklog() {
  if (AUDITLOG_FLUSHING) return;
  var backlog = [];
  try {
    backlog = JSON.parse(localStorage.getItem(AUDITLOG_BACKLOG_KEY) || '[]');
  } catch (e) { return; }
  if (!backlog.length) return;

  AUDITLOG_FLUSHING = true;
  window.db.from('audit_logs').insert(backlog).then(function () {
    localStorage.removeItem(AUDITLOG_BACKLOG_KEY);
    AUDITLOG_FLUSHING = false;
  }).catch(function () {
    AUDITLOG_FLUSHING = false;
  });
}

function checkLogin() {
  var userData = localStorage.getItem('supabase_user');
  if (!userData) {
    window.location.href = 'login.html';
    return null;
  }
  try {
    return JSON.parse(userData);
  } catch (e) {
    window.location.href = 'login.html';
    return null;
  }
}

// ---- 模块页面权限拦截 ----
// 在页面 init 中调用：await guardModuleAccess('secretariat') 或 'study'
// 管理员/超级管理员直接放行；普通用户检查当前学期 module_memberships
async function guardModuleAccess(moduleKey) {
  var profile = checkLogin();
  if (!profile) return false;

  // 平台管理员直接放行
  if (profile.role === '超级管理员' || profile.role === '管理员') return true;

  try {
    var semId = await getCurrentSemesterId();
    if (!semId) {
      showToast('当前学期未设置，请联系管理员', 'error');
      setTimeout(function () { window.location.href = 'portal.html'; }, 1500);
      return false;
    }
    var result = await window.db
      .from('module_memberships')
      .select('id')
      .eq('user_id', profile.id)
      .eq('semester_id', semId)
      .eq('module_key', moduleKey)
      .eq('enabled', true)
      .maybeSingle();
    if (result.data) return true;
  } catch (e) {
    console.error('guardModuleAccess error:', e);
  }

  showToast('当前学期暂无"' + moduleKey + '"模块权限，请联系管理员或秘书处', 'error');
  setTimeout(function () { window.location.href = 'portal.html'; }, 2000);
  return false;
}

// 督察旧系统权限拦截：优先使用当前学期 module_memberships，保留旧角色兜底
async function guardSupervisionAccess() {
  var profile = checkLogin();
  if (!profile) return false;

  if (profile.role === '超级管理员' || profile.role === '管理员') return true;

  try {
    var semId = await getCurrentSemesterId();
    if (semId) {
      var result = await window.db
        .from('module_memberships')
        .select('id')
        .eq('user_id', profile.id)
        .eq('semester_id', semId)
        .eq('module_key', 'supervision')
        .eq('enabled', true)
        .maybeSingle();
      if (result.data) return true;
    }
  } catch (e) {
    console.error('guardSupervisionAccess error:', e);
  }

  var legacyRoles = [
    '大班总督',
    '大班副督',
    '班级总督察',
    '班级副总督察',
    '小组督察',
    '小组副督察'
  ];
  if (legacyRoles.indexOf(profile.role) !== -1) return true;

  showToast('当前学期暂无督察模块权限，请联系管理员或秘书处', 'error');
  setTimeout(function () { window.location.href = 'portal.html'; }, 2000);
  return false;
}

// ---- 刷新当前用户数据 ----
// 从 SDK 原生 session 获取 userId，不再依赖自定义 localStorage key

async function refreshCurrentUser() {
  try {
    if (!window.supabaseClient) return null;
    var result = await window.supabaseClient.auth.getSession();
    var userId = result.data?.session?.user?.id;
    if (!userId) return null;

    var userResult = await window.db.from('profiles').select('*, organizations(*)').eq('id', userId).single();

    if (!userResult.error && userResult.data) {
      localStorage.setItem('supabase_user', JSON.stringify(userResult.data));
      localStorage.setItem('currentUser', userResult.data.name || '');
      return userResult.data;
    }
    return null;
  } catch (e) {
    console.error('refreshCurrentUser failed:', e);
    return null;
  }
}

// ---- 当前学期 ----

var _currentSemesterId = null;

// 自动学期切换：检查是否有到达生效时间但未切换的学期
async function autoSwitchSemester() {
  // effective_at 列不存在时查询会抛异常，静默降级
  try {
    var now = new Date().toISOString();
    // 分两次查代替 or()：Supabase 不支持 or() 内 is.null
    var { data: pending } = await window.db
      .from('semesters')
      .select('id')
      .lte('effective_at', now)
      .eq('is_current', 0)
      .limit(1);
    if (!pending || pending.length === 0) {
      var { data: pending2 } = await window.db
        .from('semesters')
        .select('id')
        .lte('effective_at', now)
        .is('is_current', null)
        .limit(1);
      if (!pending2 || pending2.length === 0) return false;
      pending = pending2;
    }
    var targetId = pending[0].id;
    // 取消当前学期标记
    await window.db.from('semesters').update({ is_current: 0 }).eq('is_current', 1);
    // 设置目标学期为当前
    await window.db.from('semesters').update({ is_current: 1 }).eq('id', targetId);
    // 清除缓存
    _currentSemesterId = null;
    return true;
  } catch (e) {
    console.error('autoSwitchSemester error:', e);
    return false;
  }
}

async function getCurrentSemesterId() {
  // 先尝试自动切换
  await autoSwitchSemester();
  if (_currentSemesterId !== null) return _currentSemesterId;
  try {
    var result = await window.db.from('semesters').select('id').eq('is_current', 1).single();
    _currentSemesterId = result.data ? result.data.id : null;
  } catch (e) {
    _currentSemesterId = null;
  }
  return _currentSemesterId;
}

// ---- 强制导航到登录页 ----

function guardAuth() {
  var userData = localStorage.getItem('supabase_user');
  if (!userData) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ---- 日期工具 ----

// 返回本地日期字符串 YYYY-MM-DD（避免 UTC 时区问题）
function getToday() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var dt = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dt;
}

// ---- 公式计算 ----

// 计算考核公式，fieldMap: { 中文名: 数值 }
// 仅支持四则运算（+ - * /）、小括号与正数/小数数字，拒绝所有非法字符防止代码注入
function calcFormula(formula, fieldMap) {
  if (!formula) return null;
  var expr = formula.trim();

  Object.keys(fieldMap).forEach(function (name) {
    var val = Number(fieldMap[name]) || 0;
    expr = expr.replace(new RegExp(name, 'g'), '(' + val + ')');
  });

  // 安全检查：只允许数字、运算符、小数点、小括号、空白
  if (/[^0-9+\-*/().%\s]/.test(expr)) return null;

  try {
    // 使用 Function 前已通过正则白名单过滤，确保表达式中只有数学运算
    var result = new Function('return ' + expr)();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch (e) {
    return null;
  }
}

// ---- 自动刷新用户数据 ----

(function () {
  // 从 bfcache 恢复时刷新用户角色
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && typeof refreshCurrentUser === 'function') {
      refreshCurrentUser();
    }
  });

  // Tab 切换回来时刷新用户角色
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && typeof refreshCurrentUser === 'function') {
      refreshCurrentUser();
    }
  });
})();
