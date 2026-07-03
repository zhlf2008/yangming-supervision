(function () {
  'use strict';

  function html(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function normalizeDate(dateText) {
    var source = String(dateText || '');
    var parts = source.split('-');
    var date = new Date(source + 'T00:00:00');
    var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return {
      year: parts[0] || '',
      month: parts[1] || '--',
      day: parts[2] || '--',
      weekday: Number.isNaN(date.getTime()) ? '' : weekdays[date.getDay()]
    };
  }

  function safeHighlight(entry) {
    var highlight = String((entry && entry.highlight_text) || '').trim();
    var content = String((entry && entry.content) || '');
    return highlight && content.indexOf(highlight) !== -1 ? highlight : '';
  }

  function renderEntry(entry, groupIndex, entryIndex, scope) {
    var highlight = safeHighlight(entry);
    var indexText =
      scope === 'group'
        ? String(entryIndex + 1).padStart(2, '0')
        : String(groupIndex + 1).padStart(2, '0') + ' — ' + String(entryIndex + 1).padStart(2, '0');
    return (
      '<article class="elp-entry">' +
      '<div class="elp-entry-side">' +
      '<div class="elp-entry-index">' +
      indexText +
      '</div>' +
      '<h3 class="elp-entry-name">' +
      html(entry.person_name_snapshot || '未署名') +
      '</h3>' +
      '<div class="elp-entry-tag">优秀作业原文</div>' +
      '</div>' +
      '<div>' +
      (highlight ? '<p class="elp-quote">' + html(highlight) + '</p>' : '') +
      '<div class="elp-essay">' +
      html(entry.content || '') +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderGroup(group, groupIndex, totalGroups, scope) {
    var entries = (group.entries || []).slice(0, 3);
    var entriesHtml = entries.length
      ? entries
          .map(function (entry, entryIndex) {
            return renderEntry(entry, groupIndex, entryIndex, scope);
          })
          .join('')
      : '<div class="elp-entry"><div class="elp-entry-side"><div class="elp-entry-index">--</div></div>' +
        '<div class="elp-essay">本组当前没有已填报的优秀作业。</div></div>';
    var watermark =
      String(group.name || '组')
        .replace(/组$/, '')
        .slice(-1) || '组';
    return (
      '<section class="elp-group">' +
      '<div class="elp-group-watermark">' +
      html(watermark) +
      '</div>' +
      '<header class="elp-group-head">' +
      (scope === 'class' ? '<div class="elp-group-no">' + String(groupIndex + 1).padStart(2, '0') + '</div>' : '') +
      '<div><div class="elp-group-kicker">GROUP · SELECTED WORKS</div>' +
      '<h2 class="elp-group-name">' +
      html(group.name || '未命名小组') +
      '</h2></div>' +
      '<div class="elp-group-count">' +
      entries.length +
      ' SELECTED<br />WORKS</div>' +
      '</header>' +
      entriesHtml +
      '<footer class="elp-group-foot"><span>' +
      html(group.name || '小组') +
      ' · 优秀作业选录</span><span>' +
      (scope === 'class'
        ? String(groupIndex + 1).padStart(2, '0') + ' / ' + String(totalGroups).padStart(2, '0')
        : entries.length + ' 篇') +
      '</span></footer>' +
      '</section>'
    );
  }

  function create(options) {
    var opts = options || {};
    var scope = opts.scope === 'class' ? 'class' : 'group';
    var groups = (opts.groups || []).filter(Boolean);
    var className = opts.className || '未命名班级';
    var date = normalizeDate(opts.date);
    var entryTotal = groups.reduce(function (count, group) {
      return count + Math.min((group.entries || []).length, 3);
    }, 0);
    var primaryName = scope === 'group' && groups[0] ? groups[0].name : className;
    var brand = scope === 'group' ? className + ' · 小组优秀作业' : '阳明心学 · 班级优秀作业';
    var summary =
      scope === 'group'
        ? '<b>' + entryTotal + '</b> 篇优秀作业'
        : '<b>' + groups.length + '</b> 个小组 <i>·</i> <b>' + entryTotal + '</b> 篇优秀作业';
    var groupHtml = groups
      .map(function (group, index) {
        return renderGroup(group, index, groups.length, scope);
      })
      .join('');

    var poster = document.createElement('article');
    poster.className = 'editorial-long-poster scope-' + scope;
    poster.setAttribute('data-poster-scope', scope);
    poster.innerHTML =
      '<header class="elp-hero">' +
      '<div class="elp-hero-top"><div class="elp-brand">' +
      html(brand) +
      '</div><div class="elp-issue">' +
      (scope === 'class' ? 'CLASS EDITION' : 'GROUP EDITION') +
      '<br />ISSUE ' +
      html(date.month + date.day) +
      '</div></div>' +
      '<div class="elp-hero-main"><div><div class="elp-hero-rule"></div>' +
      '<h1 class="elp-title">' +
      html(primaryName) +
      '<span>优秀作业</span></h1></div>' +
      '<div class="elp-date"><div class="elp-date-label">PUBLICATION DATE</div>' +
      '<div class="elp-date-main"><strong>' +
      html(date.month) +
      '</strong><i>/</i><strong>' +
      html(date.day) +
      '</strong></div><div class="elp-weekday">' +
      html(date.year + ' · ' + date.weekday) +
      '</div></div></div>' +
      '<div class="elp-hero-bottom"><div class="elp-hero-desc">' +
      (scope === 'class'
        ? '众思汇流，知行相照<br />记录每一份真切体悟'
        : '一组一章，见字见心<br />记录今日的思考与践行') +
      '</div><div class="elp-summary"><span>本期收录</span><strong>' +
      summary +
      '</strong></div></div></header>' +
      groupHtml +
      '<footer class="elp-closing"><div class="elp-closing-kicker">THE END · KEEP PRACTICING</div>' +
      '<h2>在每一次起心动念中省察，<br />在每一件具体小事上践行。</h2>' +
      '<div class="elp-closing-bottom"><div>' +
      html(className) +
      (scope === 'group' && groups[0] ? ' · ' + html(groups[0].name) : '') +
      '<br />' +
      html(date.year + '年' + Number(date.month) + '月' + Number(date.day) + '日 · ' + date.weekday) +
      '</div><div class="elp-closing-seal">知行<br />合一</div></div></footer>';
    return poster;
  }

  function mount(container, options) {
    if (!container) return null;
    container.innerHTML = '';
    var poster = create(options);
    container.appendChild(poster);
    return poster;
  }

  window.PublicityLongPoster = {
    create: create,
    mount: mount,
    safeHighlight: safeHighlight
  };
})();
