// ============================================================
// 阳明心学督察管理系统 —— 公共工具函数库
// 所有页面通过 <script src="js/utils.js"></script> 引入
// ============================================================

(function () {
  document.documentElement.style.overflowY = 'scroll';
})();

// ---- Toast ----

function showToast(msg, duration) {
  duration = duration || 2000;
  var toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;top:60px;left:50%;transform:translate(-50%,0);background:rgba(0,0,0,0.75);color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;white-space:nowrap;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () { toast.style.opacity = '0'; }, duration);
}

// ---- 周日/周x 转换 ----

var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// ---- 组织架构工具 ----

// 递归获取所有子组织（不限级别）
function getAllChildOrgs(parentId, orgs) {
  var children = orgs.filter(function (o) { return o.parent_id === parentId; });
  var result = [];
  children.forEach(function (c) {
    result.push(c);
    result = result.concat(getAllChildOrgs(c.id, orgs));
  });
  return result;
}

// 递归获取指定组织下的所有小组（仅 level='小组'）
function getAllGroups(orgId, orgs) {
  var org = orgs.find(function (o) { return o.id === orgId; });
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
  return orgs.filter(function (o) { return o.parent_id === parentId; });
}

// 构建组织完整路径名称：大班-班级-小组（参数为数组）
function buildOrgPath(orgId, orgs) {
  var org = orgs.find(function (o) { return o.id === orgId; });
  if (!org) return '';
  var parts = [org.name];
  var pid = org.parent_id;
  while (pid) {
    var parent = orgs.find(function (o) { return o.id === pid; });
    if (parent) { parts.unshift(parent.name); pid = parent.parent_id; }
    else break;
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
    if (parent) { parts.unshift(parent.name); pid = parent.parent_id; }
    else break;
  }
  return parts.join(' - ');
}

// ---- 权限工具 ----

// 根据角色和用户所属组织，获取其可访问的小组 ID 集合
function getAccessibleGroupIds(role, userOrgId, orgs) {
  var groupIds = new Set();

  if (role.includes('小组督察' || role.includes('小组副督察') {
    var myOrg = orgs.find(function (o) { return o.id === userOrgId; });
    if (myOrg && myOrg.level === '小组') groupIds.add(myOrg.id);
  } else if (role.includes('班级总督察' || role.includes('班级副总督察') {
    if (userOrgId) {
      getDirectChildrenOrgs(userOrgId, orgs).filter(function (o) { return o.level === '小组'; })
        .forEach(function (g) { groupIds.add(g.id); });
    }
  } else if (role.includes('大班总督' || role.includes('大班副督') {
    if (userOrgId) {
      getAllChildOrgs(userOrgId, orgs).filter(function (o) { return o.level === '小组'; })
        .forEach(function (g) { groupIds.add(g.id); });
    }
  } else if (role.includes('管理员' || role.includes('地区督委') {
    orgs.filter(function (o) { return o.level === '小组'; }).forEach(function (g) { groupIds.add(g.id); });
  }

  return groupIds;
}

// 根据角色获取上级组织 ID
function getParentOrgId(role, userOrgId, orgs) {
  if (role.includes('班级总督察' || role.includes('班级副总督察') {
    return userOrgId; // 班级本身
  }
  if (role.includes('大班总督' || role.includes('大班副督') {
    return userOrgId; // 大班本身
  }
  return null;
}

// ---- 用户排序 ----

function sortUsers(users) {
  return users.slice().sort(function (a, b) {
    function roleOrder(r) {
      if (r.includes('管理员')) return 0;
      if (r.includes('地区督委')) return 1;
      if (r.includes('总督')) return 2;
      if (r.includes('副督')) return 3;
      if (r.includes('总督察')) return 4;
      if (r.includes('副总督察')) return 5;
      if (r.includes('督察')) return 6;
      if (r.includes('副督察')) return 7;
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
  localStorage.removeItem('supabase_session');
  localStorage.removeItem('supabase_user');
  localStorage.removeItem('currentUser');
  window.location.replace('login.html');
}

// ---- adminApi（通过 Edge Function 代理管理员操作） ----

var adminApi = {
  _call: function (action, body) {
    var supabaseUrl = window.supabaseConfig ? window.supabaseConfig.url : '';
    var anonKey = window.supabaseConfig ? window.supabaseConfig.anonKey : '';
    return fetch(supabaseUrl + '/functions/v1/admin-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + anonKey
      },
      body: JSON.stringify(Object.assign({ action: action }, body))
    }).then(function (r) { return r.json(); });
  },

  // 删除 Auth 用户
  deleteUser: function (userId) {
    return adminApi._call('deleteUser', { userId: userId });
  },

  // 创建 Auth 用户（管理员代理，不受限流）
  createUser: function (params) {
    return adminApi._call('createUser', params);
  },

  // 更新 Auth 用户（邮箱、密码等）
  updateUser: function (userId, params) {
    return adminApi._call('updateUser', Object.assign({ userId: userId }, params));
  }
};

// ---- 检查登录状态 ----

function checkLogin() {
  var userData = localStorage.getItem('supabase_user');
  if (!userData) {
    window.location.href = 'login.html';
    return null;
  }
  try { return JSON.parse(userData); }
  catch (e) { window.location.href = 'login.html'; return null; }
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
