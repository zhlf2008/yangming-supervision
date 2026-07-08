// ============================================================
// 每日共读影像长图：按小组、班级、大班自动切换编辑画册结构
// ============================================================

var PublicityReadingPoster = (function () {
  function prpHtml(value) {
    return escapeHtml(String(value === null || value === undefined ? '' : value));
  }

  function number(value, fallback) {
    var result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function getItemAsset(item) {
    return item.asset || item;
  }

  function getItemSlot(item) {
    var asset = getItemAsset(item);
    if (item.slot_kind && item.slot_kind !== 'auto') return item.slot_kind;
    if (asset.asset_kind === 'role') return 'role';
    if (asset.asset_kind === 'overview') return 'overview';
    if (asset.asset_kind === 'moment') return 'moment';
    return 'moment';
  }

  function getCropStyle(item) {
    var x = Math.max(0, Math.min(100, number(item.crop_x, 50)));
    var y = Math.max(0, Math.min(100, number(item.crop_y, 50)));
    var zoom = Math.max(0.2, Math.min(4, number(item.crop_zoom, 1)));
    if (item.crop_frame) {
      var frame = item.crop_frame;
      var left = Math.max(0, Math.min(100, number(frame.left, 0)));
      var top = Math.max(0, Math.min(100, number(frame.top, 0)));
      var right = Math.max(left + 1, Math.min(100, number(frame.right, 100)));
      var bottom = Math.max(top + 1, Math.min(100, number(frame.bottom, 100)));
      var frameZoom = Math.max(100 / Math.max(1, right - left), 100 / Math.max(1, bottom - top));
      x = (left + right) / 2;
      y = (top + bottom) / 2;
      zoom = zoom < 1 && Math.abs(frameZoom - 1) < 0.01 ? zoom : Math.max(zoom, frameZoom);
    }
    var rotation = [0, 90, 180, 270].indexOf(number(item.rotation, 0)) !== -1 ? number(item.rotation, 0) : 0;
    return (
      'object-position:' +
      x +
      '% ' +
      y +
      '%;transform-origin:' +
      x +
      '% ' +
      y +
      '%;transform:scale(' +
      zoom +
      ') rotate(' +
      rotation +
      'deg)'
    );
  }

  function hasCrop(item) {
    return (
      Math.abs(number(item.crop_x, 50) - 50) > 0.05 ||
      Math.abs(number(item.crop_y, 50) - 50) > 0.05 ||
      Math.abs(number(item.crop_zoom, 1) - 1) > 0.01 ||
      number(item.rotation, 0) !== 0 ||
      !!item.crop_frame
    );
  }

  function imageFigure(item, className, showLabel) {
    var asset = getItemAsset(item);
    var label = asset.role_name_snapshot || '';
    var name = asset.person_name_snapshot || '';
    var caption = asset.caption || '';
    var title = label && name ? label + ' · ' + name : caption || '共读影像';
    var figureClass = className + (hasCrop(item) ? ' prp-has-crop' : '');
    var figure =
      '<figure class="' +
      figureClass +
      '"><div class="prp-image-frame"><img crossorigin="anonymous" alt="' +
      prpHtml(title) +
      '" src="' +
      prpHtml(asset.signed_url) +
      '" style="' +
      getCropStyle(item) +
      '"></div>';
    if (showLabel && className.indexOf('prp-role-card') !== -1) {
      figure +=
        '<figcaption class="prp-role-caption"><div><strong>' +
        prpHtml(name || '未命名人员') +
        '</strong><span>' +
        prpHtml(label || '焦点人物') +
        '</span></div></figcaption>';
    } else if (showLabel) {
      figure +=
        '<figcaption><span>' +
        prpHtml(label || '共读瞬间') +
        '</span><strong>' +
        prpHtml(name || caption || '晨读纪实') +
        '</strong></figcaption>';
    }
    return figure + '</figure>';
  }

  function createReadingPoster(options) {
    var opts = options || {};
    var schedule = opts.schedule || {};
    var org = opts.org || {};
    var poster = opts.poster || {};
    var readingType = opts.readingType || {};
    var items = (opts.items || [])
      .filter(function (item) {
        return item.is_visible !== false && getItemAsset(item).signed_url;
      })
      .sort(function (a, b) {
        return number(a.sort_order, 0) - number(b.sort_order, 0);
      });

    var feature = items.find(function (item) {
      return getItemSlot(item) === 'feature' && getItemAsset(item).asset_kind !== 'overview';
    });
    var rest = items.filter(function (item) {
      return item !== feature;
    });
    var roles = rest.filter(function (item) {
      return getItemSlot(item) === 'role' || getItemAsset(item).asset_kind === 'role';
    });
    var overviews = rest.filter(function (item) {
      return getItemSlot(item) === 'overview' || getItemAsset(item).asset_kind === 'overview';
    });
    var moments = rest.filter(function (item) {
      var slot = getItemSlot(item);
      return slot === 'moment' || slot === 'auto';
    });
    var scopeClass =
      {
        小组: 'small',
        班级: 'class',
        大班: 'large'
      }[schedule.scope_level] || 'small';
    var typeName = readingType.type_name || ReadingMedia.getScopeLabel(schedule.scope_level);
    var title = poster.title || org.name || '今日晨读';
    var subtitle = poster.subtitle || typeName;
    var participantCount = number(poster.participant_count, 0);
    var weekday = ReadingMedia.getWeekday(schedule.schedule_date);
    var displayDate = ReadingMedia.formatDisplayDate(schedule.schedule_date);
    var closing = poster.closing_text || '在共读中照见彼此，在践行中抵达良知。';
    var markup =
      '<article class="publicity-reading-poster prp-' +
      scopeClass +
      '">' +
      '<header class="prp-cover"><div class="prp-brand">阳明心学 · 每日共读影像</div>' +
      '<div class="prp-date-row"><span class="prp-date">' +
      prpHtml(displayDate) +
      '</span><span class="prp-weekday">' +
      prpHtml(weekday) +
      '</span></div>' +
      '<div class="prp-title-block"><div class="prp-scope">' +
      prpHtml(subtitle) +
      '</div><h1>' +
      prpHtml(title) +
      '</h1><p>' +
      prpHtml(opts.orgPath || org.name || '') +
      '</p></div>';

    if (feature) {
      markup +=
        '<div class="prp-hero">' +
        imageFigure(feature, 'prp-hero-figure', false) +
        '<div class="prp-hero-caption"><span>晨读现场</span><strong>' +
        prpHtml(getItemAsset(feature).caption || getItemAsset(feature).role_name_snapshot || '共读中的此刻') +
        '</strong></div></div>';
    }

    if (participantCount) {
      markup += '<div class="prp-stat-row"><div><strong>' + participantCount + '</strong><span>参与人数</span></div></div>';
    }

    markup += '</header>';

    if (roles.length) {
      markup +=
        '<section class="prp-section prp-role-section"><div class="prp-section-kicker">ROLES</div>' +
        '<div class="prp-section-heading"><h2>今日焦点人物</h2><p>每一个岗位，都是共读得以发生的支点。</p></div>' +
        '<div class="prp-role-grid">' +
        roles
          .map(function (item, index) {
            return imageFigure(item, 'prp-role-card prp-role-card-' + ((index % 4) + 1), true);
          })
          .join('') +
        '</div></section>';
    }

    if (overviews.length) {
      markup +=
        '<section class="prp-section prp-overview-section"><div class="prp-section-kicker">TOGETHER</div>' +
        '<div class="prp-section-heading"><h2>' +
        prpHtml(scopeClass === 'large' ? '同心共读' : '共读现场') +
        '</h2><p>' +
        prpHtml(scopeClass === 'large' ? '以大班为舟，同向而行。' : '在同一段文字里相遇，在彼此回应中生长。') +
        '</p></div><div class="prp-overview-grid ' +
        (overviews.length >= 4 ? 'prp-overview-grid-two' : 'prp-overview-grid-single') +
        '">' +
        overviews
          .map(function (item) {
            return imageFigure(item, 'prp-overview-card', false);
          })
          .join('') +
        '</div></section>';
    }

    if (moments.length) {
      markup +=
        '<section class="prp-section prp-moment-section"><div class="prp-section-kicker">MOMENTS</div>' +
        '<div class="prp-section-heading"><h2>晨光里的片段</h2><p>真实的神情，比堆满画面的名单更有力量。</p></div>' +
        '<div class="prp-moment-grid">' +
        moments
          .map(function (item) {
            return imageFigure(item, 'prp-moment-card', true);
          })
          .join('') +
        '</div></section>';
    }

    markup +=
      '<footer class="prp-footer"><div class="prp-footer-mark">知行合一</div><blockquote>' +
      prpHtml(closing) +
      '</blockquote><div class="prp-footer-meta"><span>' +
      prpHtml(title) +
      '</span><span>' +
      prpHtml(displayDate) +
      '</span></div></footer></article>';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = markup;
    return wrapper.firstElementChild;
  }

  return {
    create: createReadingPoster,
    getCropStyle: getCropStyle,
    getItemSlot: getItemSlot
  };
})();
