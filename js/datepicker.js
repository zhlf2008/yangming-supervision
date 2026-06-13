// ============================================================
// 双历日期选择器 - 阳历+农历同时显示
// 使用：createDatePicker({ ... })
// ============================================================

var _DP_INSTANCES = {};

// ---- 农历算法（1901-2100 查表法） ----
var _LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x16a95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06aa0,0x1a6c4,0x0aae0,
  0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a4d0,0x0d150,0x0f252,
  0x0d520
];

var _LUNAR_MONTH_NAMES = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
var _LUNAR_DAY_NAMES = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];

function _lunarYearInfo(year) { return _LUNAR_INFO[year - 1900] || 0x04ae0; }
function _lunarYearDays(year) {
  var sum = 348, info = _lunarYearInfo(year);
  for (var i = 0x8000; i > 0x8; i >>= 1) sum += (info & i) ? 1 : 0;
  return sum + (_lunarLeapMonth(year) ? _lunarLeapDays(year) : 0);
}
function _lunarLeapMonth(year) { return _lunarYearInfo(year) & 0xf; }
function _lunarLeapDays(year) { return (_lunarYearInfo(year) & 0x10000) ? 30 : 29; }
function _lunarMonthDays(year, month) { return (_lunarYearInfo(year) & (0x10000 >> month)) ? 30 : 29; }
function _lunarDayName(day) { return _LUNAR_DAY_NAMES[day - 1] || day + '日'; }
function _lunarMonthName(month) { return _LUNAR_MONTH_NAMES[month - 1] || month + '月'; }

function _solarToLunar(year, month, day) {
  var baseDate = new Date(1900, 0, 31);
  var targetDate = new Date(year, month - 1, day);
  var offset = Math.floor((targetDate - baseDate) / 86400000);
  if (offset < 0) return { year: year, month: 1, day: 1, isLeap: false };
  var i, temp = 0, lunarYear;
  for (i = 1900; i < 2101 && offset > 0; i++) { temp = _lunarYearDays(i); offset -= temp; }
  if (offset < 0) { offset += temp; i--; }
  lunarYear = i;
  var leapMonth = _lunarLeapMonth(lunarYear), isLeap = false;
  for (i = 1; i <= 12 && offset > 0; i++) {
    if (leapMonth > 0 && i === leapMonth + 1 && !isLeap) { i--; isLeap = true; temp = _lunarLeapDays(lunarYear); }
    else { temp = _lunarMonthDays(lunarYear, i); isLeap = false; }
    offset -= temp;
  }
  if (offset === 0 && leapMonth > 0 && !isLeap && i === leapMonth + 1) { isLeap = true; i = leapMonth; temp = _lunarLeapDays(lunarYear); }
  if (offset < 0) { offset += temp; i--; }
  return { year: lunarYear, month: i, day: offset + 1, isLeap: isLeap };
}

function _formatLunarShort(l) {
  if (l.day === 1) return (l.isLeap ? '闰' : '') + _lunarMonthName(l.month) + '月';
  return _lunarDayName(l.day);
}

// ====== 创建日期选择器 ======
// options: { triggerId, popupId, displayId, lunarDisplayId, onSelect, initial, minDate, maxDate }
function createDatePicker(opts) {
  var inst = {
    year: 0, month: 0,
    selected: null,
    tempSelected: null,
    opts: opts,
    triggerEl: document.getElementById(opts.triggerId),
    popupEl: document.getElementById(opts.popupId),
    displayEl: document.getElementById(opts.displayId)
  };

  // Init to today
  var today = new Date();
  inst.year = today.getFullYear();
  inst.month = today.getMonth() + 1;

  // Set initial date if provided
  if (opts.initial) {
    var parts = opts.initial.split('-');
    if (parts.length === 3) {
      inst.selected = { year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) };
      inst.year = inst.selected.year;
      inst.month = inst.selected.month;
      _dpUpdateDisplay(inst);
    }
  }

  var id = opts.triggerId;
  _DP_INSTANCES[id] = inst;

  // Trigger click
  inst.triggerEl.addEventListener('click', function(e) {
    e.stopPropagation();
    // Close all other pickers
    for (var k in _DP_INSTANCES) {
      if (k !== id && _DP_INSTANCES[k].popupEl) {
        _DP_INSTANCES[k].popupEl.classList.remove('open');
      }
    }
    inst.popupEl.classList.toggle('open');
    _dpRender(inst);
  });

  return inst;
}

function _dpRender(inst) {
  var dpYear = inst.year, dpMonth = inst.month;
  inst.popupEl.innerHTML =
    '<div class="dp-header">' +
    '<button class="dp-nav" onclick="_dpPrevMonth(\'' + inst.opts.triggerId + '\')">&#x25C0;</button>' +
    '<div class="dp-year-month">' + dpYear + '年' + dpMonth + '月</div>' +
    '<button class="dp-nav" onclick="_dpNextMonth(\'' + inst.opts.triggerId + '\')">&#x25B6;</button></div>' +
    '<div class="dp-weekdays"><div class="dp-weekday sun">日</div><div class="dp-weekday">一</div><div class="dp-weekday">二</div><div class="dp-weekday">三</div><div class="dp-weekday">四</div><div class="dp-weekday">五</div><div class="dp-weekday sun">六</div></div>' +
    '<div class="dp-days" id="_dpDays_' + inst.opts.triggerId + '"></div>' +
    '<div class="dp-footer"><button class="dp-cancel-btn" onclick="_dpClose(\'' + inst.opts.triggerId + '\')">取消</button>' +
    '<button class="dp-today-btn" onclick="_dpGoToday(\'' + inst.opts.triggerId + '\')">今天</button>' +
    '<button class="dp-confirm-btn" onclick="_dpConfirm(\'' + inst.opts.triggerId + '\')">确定</button></div>';

  var firstDay = new Date(dpYear, dpMonth - 1, 1).getDay();
  var daysInMonth = new Date(dpYear, dpMonth, 0).getDate();
  var prevMonthDays = new Date(dpYear, dpMonth - 1, 0).getDate();
  var today = new Date(), todayStr = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
  var html = '';

  for (var i = firstDay - 1; i >= 0; i--) {
    html += '<div class="dp-day other-month past"><div class="dp-solar">' + (prevMonthDays - i) + '</div><div class="dp-lunar"></div></div>';
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var dateObj = new Date(dpYear, dpMonth - 1, d);
    var dateStr = dpYear + '-' + dpMonth + '-' + d;
    var isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var isToday = dateStr === todayStr;
    var lunar = _solarToLunar(dpYear, dpMonth, d);
    var lunarStr = _formatLunarShort(lunar);
    var selected = inst.selected && inst.selected.year === dpYear && inst.selected.month === dpMonth && inst.selected.day === d;
    var cls = 'dp-day';
    if (isPast) cls += ' past';
    if (isToday) cls += ' today';
    if (selected) cls += ' selected';
    html += '<div class="' + cls + '" data-year="' + dpYear + '" data-month="' + dpMonth + '" data-day="' + d + '" onclick="_dpClick(this,\'' + inst.opts.triggerId + '\')"><div class="dp-solar">' + d + '</div><div class="dp-lunar">' + lunarStr + '</div></div>';
  }

  var totalCells = firstDay + daysInMonth;
  var remaining = (7 - totalCells % 7) % 7;
  for (var i = 1; i <= remaining; i++) {
    html += '<div class="dp-day other-month past"><div class="dp-solar">' + i + '</div><div class="dp-lunar"></div></div>';
  }

  document.getElementById('_dpDays_' + inst.opts.triggerId).innerHTML = html;

  // 左箭头可见性
  var prevBtn = inst.popupEl.querySelector('.dp-nav:first-child');
  if (prevBtn) {
    var now = new Date();
    prevBtn.style.visibility = (dpYear <= now.getFullYear() && dpMonth <= now.getMonth() + 1) ? 'hidden' : '';
  }
}

function _dpPrevMonth(id) {
  var inst = _DP_INSTANCES[id];
  if (!inst) return;
  var now = new Date();
  if (inst.year <= now.getFullYear() && inst.month <= now.getMonth() + 1) return;
  inst.month--;
  if (inst.month < 1) { inst.month = 12; inst.year--; }
  _dpRender(inst);
}

function _dpNextMonth(id) {
  var inst = _DP_INSTANCES[id];
  if (!inst) return;
  inst.month++;
  if (inst.month > 12) { inst.month = 1; inst.year++; }
  _dpRender(inst);
}

function _dpGoToday(id) {
  var inst = _DP_INSTANCES[id];
  if (!inst) return;
  var today = new Date();
  inst.year = today.getFullYear();
  inst.month = today.getMonth() + 1;
  _dpRender(inst);
}

function _dpClick(el, id) {
  if (el.classList.contains('past') || el.classList.contains('other-month')) return;
  var inst = _DP_INSTANCES[id];
  if (!inst) return;
  inst.tempSelected = { year: parseInt(el.dataset.year), month: parseInt(el.dataset.month), day: parseInt(el.dataset.day) };
  el.parentNode.querySelectorAll('.dp-day').forEach(function(d) { d.classList.remove('selected'); });
  el.classList.add('selected');
}

function _dpConfirm(id) {
  var inst = _DP_INSTANCES[id];
  if (!inst) return;
  if (inst.tempSelected) inst.selected = inst.tempSelected;
  else if (!inst.selected) return;
  _dpUpdateDisplay(inst);
  _dpClose(id);
  if (inst.opts.onSelect) {
    var s = inst.selected;
    var m = String(s.month).padStart(2,'0');
    var d = String(s.day).padStart(2,'0');
    inst.opts.onSelect(s.year + '-' + m + '-' + d);
  }
}

function _dpClose(id) {
  var inst = _DP_INSTANCES[id];
  if (inst && inst.popupEl) inst.popupEl.classList.remove('open');
}

function _dpUpdateDisplay(inst) {
  if (!inst.selected) return;
  var s = inst.selected;
  inst.displayEl.textContent = s.year + '年' + s.month + '月' + s.day + '日';
  inst.displayEl.style.color = 'var(--ink-dark)';
  var lunar = _solarToLunar(s.year, s.month, s.day);
  if (inst.opts.lunarDisplayId) {
    var lunarEl = document.getElementById(inst.opts.lunarDisplayId);
    if (lunarEl) lunarEl.textContent = '农历' + _formatLunarShort(lunar);
  }
}

// 全局关闭：点击页面其他位置关闭所有弹出
document.addEventListener('click', function() {
  for (var k in _DP_INSTANCES) {
    var inst = _DP_INSTANCES[k];
    if (inst.popupEl && inst.popupEl.classList.contains('open')) {
      // Will be closed in the next event cycle if not clicking on the picker
    }
  }
});

// 点击弹出框内部不关闭
document.addEventListener('click', function(e) {
  for (var k in _DP_INSTANCES) {
    var inst = _DP_INSTANCES[k];
    if (inst.popupEl && inst.popupEl.classList.contains('open')) {
      if (!inst.popupEl.contains(e.target) && e.target !== inst.triggerEl && !inst.triggerEl.contains(e.target)) {
        inst.popupEl.classList.remove('open');
      }
    }
  }
});
