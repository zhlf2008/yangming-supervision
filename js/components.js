// ============================================================
// 阳明心学督察管理系统 —— 共享 UI 组件
// 所有页面通过 <script src="js/components.js"></script> 引入
// ============================================================

// ---- 当前系统来源 ----
function setActiveSystem(systemKey) {
  if (!systemKey) return;
  try {
    sessionStorage.setItem('activeSystem', systemKey);
    localStorage.setItem('activeSystem', systemKey);
  } catch (e) {}
}

function getActiveSystem() {
  var allowed = ['portal', 'supervision', 'secretariat', 'study', 'publicity', 'life', 'organization'];
  try {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get('system');
    if (allowed.indexOf(fromQuery) !== -1) {
      setActiveSystem(fromQuery);
      return fromQuery;
    }

    var path = window.location.pathname || '';
    if (path.indexOf('secretariat-') !== -1) return 'secretariat';
    if (path.indexOf('study-') !== -1) return 'study';
    if (path.indexOf('publicity-') !== -1) return 'publicity';
    if (path.indexOf('life-') !== -1) return 'life';
    if (path.indexOf('organization-') !== -1 || path.indexOf('activity-registration') !== -1) return 'organization';
    if (path.indexOf('portal.html') !== -1) return 'portal';

    var fromSession = sessionStorage.getItem('activeSystem');
    if (allowed.indexOf(fromSession) !== -1) return fromSession;

    var fromLocal = localStorage.getItem('activeSystem');
    if (allowed.indexOf(fromLocal) !== -1) return fromLocal;
  } catch (e) {}
  return 'supervision';
}

// ---- 底部导航栏 ----
// activePage: 'home' | 'attendance' | 'summary' | 'profile'
function renderBottomNav(activePage) {
  var container = document.getElementById('bottomNavContainer');
  if (!container) return;
  setActiveSystem('supervision');

  var pages = [
    { key: 'home', href: 'index.html', icon: 'HomeIcon', label: '首页' },
    { key: 'attendance', href: 'attendance-page.html', icon: 'ClipboardCheckIcon', label: '考勤' },
    { key: 'summary', href: 'summary-page.html', icon: 'ChartIcon', label: '汇总' },
    { key: 'rank', href: 'leaderboard.html', icon: 'TrophyIcon', label: '榜单' },
    { key: 'profile', href: 'profile.html?system=supervision', icon: 'UserIcon', label: '我的' }
  ];

  var html = '<nav class="bottom-nav">';
  pages.forEach(function (p) {
    html += '<a href="' + withFrom(p.href) + '" class="nav-item' + (p.key === activePage ? ' active' : '') + '">';
    html += appIcon(p.icon, 'nav-icon');
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

// ---- 平台首页底部导航栏 ----
function renderPortalBottomNav(activePage) {
  var container = document.getElementById('bottomNavContainer');
  if (!container) return;
  setActiveSystem('portal');

  var pages = [
    { key: 'home', href: 'portal.html', icon: 'HomeIcon', label: '首页' },
    { key: 'supervision', href: 'index.html', icon: 'ClipboardCheckIcon', label: '督察' },
    { key: 'secretariat', href: 'secretariat-dashboard.html', icon: 'BuildingIcon', label: '秘书处' },
    { key: 'study', href: 'study-dashboard.html', icon: 'BookOpenIcon', label: '学委' },
    { key: 'profile', href: 'profile.html?system=portal', icon: 'UserIcon', label: '我的' }
  ];

  var html = '<nav class="bottom-nav portal-bottom-nav">';
  pages.forEach(function (p) {
    html += '<a href="' + withFrom(p.href) + '" class="nav-item' + (p.key === activePage ? ' active' : '') + '">';
    html += appIcon(p.icon, 'nav-icon');
    html += '<span class="nav-label">' + p.label + '</span>';
    html += '</a>';
  });
  html += '</nav>';
  container.innerHTML = html;

  var navEl = container.querySelector('.bottom-nav');
  if (navEl) {
    navEl.style.transform = 'translateZ(0)';
    navEl.style.willChange = 'transform';
  }
}

// ---- 独立系统底部导航栏 ----
// systemKey: 'secretariat' | 'study' | 'publicity' | 'life' | 'organization'
function renderModuleBottomNav(systemKey, activePage) {
  var container = document.getElementById('bottomNavContainer');
  if (!container) return;
  setActiveSystem(systemKey);
  if (systemKey === 'study' && (activePage === 'rules' || activePage === 'weekly')) {
    activePage = 'management';
  }

  var navMap = {
    secretariat: [
      { key: 'home', href: 'secretariat-dashboard.html', icon: 'HomeIcon', label: '首页' },
      { key: 'org', href: 'secretariat-org-management.html', icon: 'BuildingIcon', label: '组织' },
      { key: 'people', href: 'secretariat-people.html', icon: 'UsersIcon', label: '人员' },
      { key: 'entry', href: 'secretariat-entry-form.html', icon: 'ClipboardCheckIcon', label: '进班' },
      { key: 'profile', href: 'profile.html?system=secretariat', icon: 'UserIcon', label: '我的' }
    ],
    study: [
      { key: 'home', href: 'study-dashboard.html', icon: 'HomeIcon', label: '首页' },
      { key: 'management', href: 'study-committee-management.html', icon: 'CalendarIcon', label: '晨读' },
      { key: 'media', href: 'study-reading-media.html', icon: 'ImagesIcon', label: '影像' },
      { key: 'homework', href: 'study-excellent-homework.html', icon: 'TrophyIcon', label: '作业' },
      { key: 'profile', href: 'profile.html?system=study', icon: 'UserIcon', label: '我的' }
    ],
    publicity: [
      { key: 'home', href: 'publicity-dashboard.html', icon: 'HomeIcon', label: '首页' },
      { key: 'cards', href: 'publicity-homework-card.html', icon: 'FileEditIcon', label: '作业卡' },
      { key: 'media', href: 'publicity-reading-media.html', icon: 'ImagesIcon', label: '晨读' },
      { key: 'profile', href: 'profile.html?system=publicity', icon: 'UserIcon', label: '我的' }
    ],
    life: [
      { key: 'home', href: 'birthday-care-dashboard.html', icon: 'HomeIcon', label: '首页' },
      { key: 'birthday', href: 'birthday-care-dashboard.html', icon: 'CakeSliceIcon', label: '生日关怀' },
      { key: 'profile', href: 'profile.html?system=life', icon: 'UserIcon', label: '我的' }
    ],
    organization: [
      { key: 'home', href: 'organization-dashboard.html', icon: 'HomeIcon', label: '首页' },
      { key: 'activities', href: 'organization-dashboard.html', icon: 'CalendarPlusIcon', label: '活动' },
      { key: 'profile', href: 'profile.html?system=organization', icon: 'UserIcon', label: '我的' }
    ]
  };

  var pages = navMap[systemKey] || [];
  var html = '<nav class="bottom-nav module-bottom-nav">';
  pages.forEach(function (p) {
    html += '<a href="' + withFrom(p.href) + '" class="nav-item' + (p.key === activePage ? ' active' : '') + '">';
    html += appIcon(p.icon, 'nav-icon');
    html += '<span class="nav-label">' + p.label + '</span>';
    html += '</a>';
  });
  html += '</nav>';
  container.innerHTML = html;

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
  orgs.forEach(function (o) {
    orgsMap[o.id] = o;
  });

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
      '<span>大班：<b id="' +
      containerId +
      '_bigClassName" style="color:var(--ink-dark)">--</b></span>' +
      '<span>班级：<b id="' +
      containerId +
      '_className" style="color:var(--ink-dark)">--</b></span>' +
      '<span>小组：<b id="' +
      containerId +
      '_groupName" style="color:var(--ink-dark)">--</b></span>' +
      '</div>';
  }

  container.innerHTML =
    '<div style="background:var(--bg-card);border-radius:var(--radius);padding:16px;' +
    'box-shadow:0 2px 12px var(--shadow);border:1px solid var(--border);">' +
    '<div class="org-cascade">' +
    '<select id="' +
    containerId +
    '_bigClassSelect" class="org-select"><option value="">选择大班</option></select>' +
    '<select id="' +
    containerId +
    '_classSelect" class="org-select"><option value="">选择班级</option></select>' +
    '<select id="' +
    containerId +
    '_groupSelect" class="org-select"><option value="">' +
    (showAllOption ? '全部小组' : '选择小组') +
    '</option></select>' +
    '</div>' +
    labelsHtml +
    '</div>';

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
    var myOrg = orgs.find(function (o) {
      return o.id === userOrgId;
    });
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
      orgs
        .filter(function (o) {
          return o.parent_id === userOrgId && o.level === '小组';
        })
        .forEach(function (g) {
          selectableGroupIds.add(g.id);
        });
    }
  } else if (role === '大班总督' || role === '大班副督') {
    if (userOrgId) {
      getAllChildOrgs(userOrgId, orgs)
        .filter(function (o) {
          return o.level === '小组';
        })
        .forEach(function (g) {
          selectableGroupIds.add(g.id);
        });
    }
  } else if (role === '超级管理员' || role === '管理员') {
    orgs
      .filter(function (o) {
        return o.level === '小组';
      })
      .forEach(function (g) {
        selectableGroupIds.add(g.id);
      });
  }

  if (selectableGroupIds.size === 0) {
    document.getElementById(containerId + '_bigClassSelect').innerHTML = '<option value="">无可选小组</option>';
    return;
  }

  var groups = orgs.filter(function (o) {
    return selectableGroupIds.has(o.id);
  });
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
  bcs.innerHTML =
    (bigClasses.length === 1 ? '' : '<option value="">请选择</option>') +
    bigClasses
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, 'zh-CN');
      })
      .map(function (b) {
        return '<option value="' + b.id + '">' + b.name + '</option>';
      })
      .join('');

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

  if (!bigClassId) {
    _fireGroupChange(containerId, null);
    return;
  }

  var classIds = new Set();
  orgs
    .filter(function (o) {
      return o.parent_id === bigClassId && o.level === '班级';
    })
    .forEach(function (c) {
      classIds.add(c.id);
    });

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
  classIds.forEach(function (id) {
    var o = state.orgsMap[id];
    if (o) classes.push(o);
  });
  classSelect.innerHTML =
    (classes.length === 1 ? '' : '<option value="">请选择</option>') +
    classes
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, 'zh-CN');
      })
      .map(function (c) {
        return '<option value="' + c.id + '">' + c.name + '</option>';
      })
      .join('');

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

  if (!classId) {
    _fireGroupChange(containerId, null);
    return;
  }

  var groupIds = new Set();
  orgs
    .filter(function (o) {
      return o.parent_id === classId && o.level === '小组';
    })
    .forEach(function (g) {
      groupIds.add(g.id);
    });

  if (role === '小组督察' || role === '小组副督察') {
    var userOrg = state.orgsMap[userOrgId];
    if (userOrg && userOrg.level === '小组' && groupIds.has(userOrgId)) {
      groupIds = new Set([userOrgId]);
    }
  }

  var groups = [];
  groupIds.forEach(function (id) {
    var o = state.orgsMap[id];
    if (o) groups.push(o);
  });

  var defaultOption = state.showAllOption ? '<option value="">全部小组</option>' : '';
  if (groups.length === 1 && !state.showAllOption) defaultOption = '';

  groupSelect.innerHTML =
    defaultOption +
    groups
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, 'zh-CN');
      })
      .map(function (g) {
        return '<option value="' + g.id + '">' + g.name + '</option>';
      })
      .join('');

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

// ---- 统一日期选择器 ----
var simpleDatePickers = {};

function formatSimpleDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function parseSimpleDate(value) {
  if (!value) return null;
  var parts = String(value).split('-').map(function (p) { return parseInt(p, 10); });
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function sameSimpleDate(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function initSimpleDatePicker(inputId, options) {
  var input = document.getElementById(inputId);
  if (!input || simpleDatePickers[inputId]) return;
  var opts = options || {};
  var wrap = document.getElementById(opts.wrapId || inputId + 'PickerWrap');
  var trigger = document.getElementById(opts.triggerId || inputId + 'Trigger');
  var popup = document.getElementById(opts.popupId || inputId + 'Popup');
  var title = document.getElementById(opts.titleId || inputId + 'DpTitle');
  var days = document.getElementById(opts.daysId || inputId + 'DpDays');
  var display = document.getElementById(opts.displayId || inputId + 'Display');
  if (!wrap || !trigger || !popup || !title || !days || !display) return;

  var selected = parseSimpleDate(input.value);
  var viewDate = selected ? new Date(selected) : new Date();

  function close() {
    popup.classList.remove('open');
  }

  function syncDisplay() {
    selected = parseSimpleDate(input.value);
    if (selected) {
      display.textContent = formatSimpleDate(selected);
      display.classList.remove('placeholder');
      viewDate = new Date(selected);
    } else {
      display.textContent = opts.placeholder || '点击选择日期';
      display.classList.add('placeholder');
    }
    render();
  }

  function commit(date) {
    selected = new Date(date);
    input.value = formatSimpleDate(selected);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    syncDisplay();
    close();
  }

  function render() {
    var year = viewDate.getFullYear();
    var month = viewDate.getMonth();
    title.textContent = year + '年' + String(month + 1).padStart(2, '0') + '月';
    var first = new Date(year, month, 1);
    var start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    var today = new Date();
    var html = '';
    for (var i = 0; i < 42; i++) {
      var date = new Date(start);
      date.setDate(start.getDate() + i);
      var classes = ['dp-day'];
      if (date.getMonth() !== month) classes.push('other-month');
      if (sameSimpleDate(date, today)) classes.push('today');
      if (sameSimpleDate(date, selected)) classes.push('selected');
      html += '<button type="button" class="' + classes.join(' ') + '" data-date="' + formatSimpleDate(date) + '"><span class="dp-solar">' + date.getDate() + '</span></button>';
    }
    days.innerHTML = html;
  }

  trigger.addEventListener('click', function () {
    Object.keys(simpleDatePickers).forEach(function (key) {
      if (key !== inputId) simpleDatePickers[key].close();
    });
    popup.classList.toggle('open');
    render();
  });
  trigger.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      trigger.click();
    }
  });
  days.addEventListener('click', function (event) {
    var btn = event.target.closest('.dp-day');
    if (!btn) return;
    commit(parseSimpleDate(btn.getAttribute('data-date')));
  });
  wrap.querySelectorAll('[data-dp-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      var action = button.getAttribute('data-dp-action');
      if (action === 'prev') {
        viewDate.setMonth(viewDate.getMonth() - 1);
        render();
      } else if (action === 'next') {
        viewDate.setMonth(viewDate.getMonth() + 1);
        render();
      } else if (action === 'today') {
        commit(new Date());
      } else if (action === 'cancel') {
        close();
      } else if (action === 'confirm') {
        commit(selected || viewDate || new Date());
      }
    });
  });

  simpleDatePickers[inputId] = { sync: syncDisplay, close: close };
  syncDisplay();
}

function syncSimpleDatePickers() {
  Object.keys(simpleDatePickers).forEach(function (key) {
    simpleDatePickers[key].sync();
  });
}

document.addEventListener('click', function (event) {
  Object.keys(simpleDatePickers).forEach(function (key) {
    var input = document.getElementById(key);
    var wrap = input ? document.getElementById(key + 'PickerWrap') : null;
    if (wrap && !wrap.contains(event.target)) {
      simpleDatePickers[key].close();
    }
  });
});
// Load the local Lucide icon set generated by better-icons.
(function loadIconRuntime() {
  if (document.querySelector('script[data-app-icon-runtime]')) return;
  var script = document.createElement('script');
  script.type = 'module';
  script.src = 'js/icon-runtime.js?v=5';
  script.dataset.appIconRuntime = 'true';
  document.head.appendChild(script);
})();

function appIcon(name, className) {
  return '<span class="' + (className || 'app-icon') + '" data-icon="' + name + '"></span>';
}
