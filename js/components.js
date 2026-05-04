// ============================================================
// 阳明心学督察管理系统 —— 共享 UI 组件
// 所有页面通过 <script src="js/components.js"></script> 引入
// ============================================================

// ---- 底部导航栏 ----
// activePage: 'home' | 'attendance' | 'summary' | 'profile'
function renderBottomNav(activePage) {
  var container = document.getElementById('bottomNavContainer');
  if (!container) return;

  var pages = [
    { key: 'home', href: 'index.html', icon: '🏠', label: '首页' },
    { key: 'attendance', href: 'attendance-page.html', icon: '📋', label: '考勤' },
    { key: 'summary', href: 'summary-page.html', icon: '📊', label: '汇总' },
    { key: 'profile', href: 'profile.html', icon: '👤', label: '我的' }
  ];

  var html = '<nav class="bottom-nav">';
  pages.forEach(function (p) {
    html += '<a href="' + p.href + '" class="nav-item' + (p.key === activePage ? ' active' : '') + '">';
    html += '<span class="nav-icon">' + p.icon + '</span>';
    html += '<span class="nav-label">' + p.label + '</span>';
    html += '</a>';
  });
  html += '</nav>';
  container.innerHTML = html;

  // 稳定导航栏位置，防止切换页面时抖动
  var navEl = container.querySelector('.bottom-nav');
  if (navEl) {
    navEl.style.transform = 'translateZ(0)';
    navEl.style.willChange = 'transform';
  }
}

// ---- 三级级联组织选择器 ----
// 渲染 大班→班级→小组 三个下拉框，带角色权限过滤
// options: {
//   containerId: string,        // 容器元素 ID
//   orgs: array,                // 组织数组 [{id, name, level, parent_id}]
//   userRole: string,           // 当前用户角色
//   userOrgId: number|null,     // 当前用户组织 ID
//   onGroupChange: function,    // 选中小组回调 (groupId: number|null)
//   showLabels: boolean,        // 是否显示选中路径标签（默认 true）
//   showAllOption: boolean      // 小组下拉是否显示"全部"选项（默认 false）
// }

var orgSelector = {};

function renderOrgCascadingSelector(options) {
  var opts = options || {};
  var containerId = opts.containerId;
  var container = document.getElementById(containerId);
  if (!container) return;

  var orgs = opts.orgs || [];
  var userRole = opts.userRole || '';
  var userOrgId = opts.userOrgId;
  var onGroupChange = opts.onGroupChange || function () {};
  var showLabels = opts.showLabels !== false;
  var showAllOption = opts.showAllOption || false;

  // Build map for fast lookup
  var orgsMap = {};
  orgs.forEach(function (o) { orgsMap[o.id] = o; });

  // Store state
  var state = {
    orgs: orgs,
    orgsMap: orgsMap,
    userRole: userRole,
    userOrgId: userOrgId,
    onGroupChange: onGroupChange,
    showAllOption: showAllOption
  };
  orgSelector[containerId] = state;

  // Render HTML
  var labelsHtml = '';
  if (showLabels) {
    labelsHtml =
      '<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:var(--ink-muted);">' +
      '<span>大班：<b id="' + containerId + '_bigClassName" style="color:var(--ink-dark)">--</b></span>' +
      '<span>班级：<b id="' + containerId + '_className" style="color:var(--ink-dark)">--</b></span>' +
      '<span>小组：<b id="' + containerId + '_groupName" style="color:var(--ink-dark)">--</b></span>' +
      '</div>';
  }

  container.innerHTML =
    '<div style="background:var(--bg-card);border-radius:var(--radius);padding:16px;' +
    'box-shadow:0 2px 12px var(--shadow);border:1px solid var(--border);">' +
    '<div style="display:flex;gap:8px;align-items:center;">' +
    '<select id="' + containerId + '_bigClassSelect" style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);font-size:14px;color:var(--ink-dark);appearance:auto;">' +
    '<option value="">选择大班</option></select>' +
    '<select id="' + containerId + '_classSelect" style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);font-size:14px;color:var(--ink-dark);appearance:auto;">' +
    '<option value="">选择班级</option></select>' +
    '<select id="' + containerId + '_groupSelect" style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);font-size:14px;color:var(--ink-dark);appearance:auto;">' +
    '<option value="">' + (showAllOption ? '全部小组' : '选择小组') + '</option></select>' +
    '</div>' + labelsHtml + '</div>';

  // Wire up change handlers
  var bigClassSelect = document.getElementById(containerId + '_bigClassSelect');
  var classSelect = document.getElementById(containerId + '_classSelect');
  var groupSelect = document.getElementById(containerId + '_groupSelect');

  bigClassSelect.addEventListener('change', function () {
    _onBigClassChange(containerId);
  });
  classSelect.addEventListener('change', function () {
    _onClassChange(containerId);
  });
  groupSelect.addEventListener('change', function () {
    _onGroupChange(containerId);
  });

  // Populate
  _initSelector(containerId);
}

// ---- 内部级联逻辑 ----

function _initSelector(containerId) {
  var state = orgSelector[containerId];
  if (!state) return;
  var orgs = state.orgs;
  var role = state.userRole;
  var userOrgId = state.userOrgId;

  // 小组督察：直接选中自己的组
  if (role === '小组督察' || role === '小组副督察') {
    var myOrg = orgs.find(function (o) { return o.id === userOrgId; });
    if (myOrg && myOrg.level === '小组') {
      var gs = document.getElementById(containerId + '_groupSelect');
      if (gs) {
        gs.innerHTML = '<option value="' + myOrg.id + '">' + myOrg.name + '</option>';
        gs.value = String(myOrg.id);
        state.onGroupChange(myOrg.id);
      }
    }
    return;
  }

  // 计算用户可访问的小组
  var selectableGroupIds = new Set();
  if (role === '班级总督察' || role === '班级副总督察') {
    if (userOrgId) {
      orgs.filter(function (o) { return o.parent_id === userOrgId && o.level === '小组'; })
        .forEach(function (g) { selectableGroupIds.add(g.id); });
    }
  } else if (role === '大班总督' || role === '大班副督') {
    if (userOrgId) {
      getAllChildOrgs(userOrgId, orgs).filter(function (o) { return o.level === '小组'; })
        .forEach(function (g) { selectableGroupIds.add(g.id); });
    }
  } else if (role === '管理员' || role === '地区督委') {
    orgs.filter(function (o) { return o.level === '小组'; })
      .forEach(function (g) { selectableGroupIds.add(g.id); });
  }

  if (selectableGroupIds.size === 0) {
    document.getElementById(containerId + '_bigClassSelect').innerHTML = '<option value="">无可选小组</option>';
    return;
  }

  var groups = orgs.filter(function (o) { return selectableGroupIds.has(o.id); });
  var bigClasses = [];
  var seen = new Set();
  groups.forEach(function (g) {
    var cls = state.orgsMap[g.parent_id];
    if (cls) {
      var bc = state.orgsMap[cls.parent_id];
      if (bc && !seen.has(bc.id)) {
        seen.add(bc.id);
        bigClasses.push(bc);
      }
    }
  });

  var bcs = document.getElementById(containerId + '_bigClassSelect');
  bcs.innerHTML = (bigClasses.length === 1 ? '' : '<option value="">请选择</option>') +
    bigClasses.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN'); })
      .map(function (b) { return '<option value="' + b.id + '">' + b.name + '</option>'; }).join('');

  if (bigClasses.length === 1) {
    bcs.value = String(bigClasses[0].id);
    _onBigClassChange(containerId);
  }

  // 自动匹配当前用户所在小组
  if (userOrgId && selectableGroupIds.has(userOrgId)) {
    var userGroup = state.orgsMap[userOrgId];
    if (userGroup && userGroup.level === '小组') {
      var cls = state.orgsMap[userGroup.parent_id];
      var bigClass = cls ? state.orgsMap[cls.parent_id] : null;
      if (bigClass) {
        bcs.value = String(bigClass.id);
        _onBigClassChange(containerId, userOrgId);
      }
    }
  }
}

function _onBigClassChange(containerId, preselectGroupId) {
  var state = orgSelector[containerId];
  if (!state) return;
  var orgs = state.orgs;
  var role = state.userRole;
  var userOrgId = state.userOrgId;

  var bigClassId = parseInt(document.getElementById(containerId + '_bigClassSelect').value);
  var classSelect = document.getElementById(containerId + '_classSelect');
  var groupSelect = document.getElementById(containerId + '_groupSelect');

  classSelect.innerHTML = '';
  groupSelect.innerHTML = '';

  // Update label
  var bigClassNameEl = document.getElementById(containerId + '_bigClassName');
  if (bigClassNameEl) bigClassNameEl.textContent = state.orgsMap[bigClassId] ? state.orgsMap[bigClassId].name : '--';

  if (!bigClassId) { _fireGroupChange(containerId, null); return; }

  var classIds = new Set();
  orgs.filter(function (o) { return o.parent_id === bigClassId && o.level === '班级'; })
    .forEach(function (c) { classIds.add(c.id); });

  // Role filtering at class level
  if (role === '班级总督察' || role === '班级副总督察') {
    if (userOrgId) {
      var userOrg = state.orgsMap[userOrgId];
      if (userOrg && userOrg.level === '班级' && classIds.has(userOrgId)) {
        classIds = new Set([userOrgId]);
      }
    }
  } else if (role === '小组督察' || role === '小组副督察') {
    var userGroup = state.orgsMap[userOrgId];
    if (userGroup && userGroup.level === '小组') {
      var cls = state.orgsMap[userGroup.parent_id];
      if (cls && classIds.has(cls.id)) {
        classIds = new Set([cls.id]);
      }
    }
  }

  var classes = [];
  classIds.forEach(function (id) { var o = state.orgsMap[id]; if (o) classes.push(o); });
  classSelect.innerHTML = (classes.length === 1 ? '' : '<option value="">请选择</option>') +
    classes.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN'); })
      .map(function (c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('');

  if (preselectGroupId) {
    var pg = state.orgsMap[preselectGroupId];
    if (pg) {
      var pcls = state.orgsMap[pg.parent_id];
      if (pcls) {
        classSelect.value = String(pcls.id);
        _onClassChange(containerId, preselectGroupId);
        return;
      }
    }
  }

  if (classes.length === 1) {
    classSelect.value = String(classes[0].id);
    _onClassChange(containerId);
  }
}

function _onClassChange(containerId, preselectGroupId) {
  var state = orgSelector[containerId];
  if (!state) return;
  var orgs = state.orgs;
  var role = state.userRole;
  var userOrgId = state.userOrgId;

  var classId = parseInt(document.getElementById(containerId + '_classSelect').value);
  var groupSelect = document.getElementById(containerId + '_groupSelect');

  groupSelect.innerHTML = '';

  // Update label
  var classNameEl = document.getElementById(containerId + '_className');
  if (classNameEl) classNameEl.textContent = state.orgsMap[classId] ? state.orgsMap[classId].name : '--';

  if (!classId) { _fireGroupChange(containerId, null); return; }

  var groupIds = new Set();
  orgs.filter(function (o) { return o.parent_id === classId && o.level === '小组'; })
    .forEach(function (g) { groupIds.add(g.id); });

  if (role === '小组督察' || role === '小组副督察') {
    var userOrg = state.orgsMap[userOrgId];
    if (userOrg && userOrg.level === '小组' && groupIds.has(userOrgId)) {
      groupIds = new Set([userOrgId]);
    }
  }

  var groups = [];
  groupIds.forEach(function (id) { var o = state.orgsMap[id]; if (o) groups.push(o); });

  var defaultOption = state.showAllOption ? '<option value="">全部小组</option>' : '';
  if (groups.length === 1 && !state.showAllOption) defaultOption = '';

  groupSelect.innerHTML = defaultOption +
    groups.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN'); })
      .map(function (g) { return '<option value="' + g.id + '">' + g.name + '</option>'; }).join('');

  if (preselectGroupId) {
    groupSelect.value = String(preselectGroupId);
    _onGroupChange(containerId);
  } else if (groups.length === 1 && !state.showAllOption) {
    groupSelect.value = String(groups[0].id);
    _onGroupChange(containerId);
  }
}

function _onGroupChange(containerId) {
  var state = orgSelector[containerId];
  if (!state) return;
  var groupId = parseInt(document.getElementById(containerId + '_groupSelect').value) || null;

  var groupNameEl = document.getElementById(containerId + '_groupName');
  if (groupNameEl && groupId) {
    groupNameEl.textContent = state.orgsMap[groupId] ? state.orgsMap[groupId].name : '--';
  } else if (groupNameEl) {
    groupNameEl.textContent = state.showAllOption ? '全部' : '--';
  }

  _fireGroupChange(containerId, groupId);
}

function _fireGroupChange(containerId, groupId) {
  var state = orgSelector[containerId];
  if (state && state.onGroupChange) {
    state.onGroupChange(groupId);
  }
}
