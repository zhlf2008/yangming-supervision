// ============================================================
// 学委 / 宣委周汇总：组织匹配、周日程与日程内容详情
// ============================================================

(function () {
  'use strict';

  var mode = document.body.getAttribute('data-summary-mode') === 'publicity' ? 'publicity' : 'study';
  var isPublicity = mode === 'publicity';
  var summaryContext = null;
  var readingContext = null;
  var currentUser = null;
  var currentGroup = null;
  var accessibleGroups = [];
  var eligibleHomeworkSchedules = [];
  var weekStart = startOfWeek(new Date());
  var weekRecords = {};
  var isLoadingWeek = false;
  var lastDetailTrigger = null;
  var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  renderModuleBottomNav(mode, 'summary');
  bindStaticEvents();
  init();

  function bindStaticEvents() {
    document.getElementById('previousWeekBtn').addEventListener('click', function () {
      changeWeek(-7);
    });
    document.getElementById('nextWeekBtn').addEventListener('click', function () {
      changeWeek(7);
    });
    document.getElementById('currentWeekBtn').addEventListener('click', function () {
      weekStart = startOfWeek(new Date());
      loadWeek();
    });
    document.getElementById('bigClassSelect').addEventListener('change', function () {
      onBigClassChange(this.value);
    });
    document.getElementById('classSelect').addEventListener('change', function () {
      onClassChange(this.value);
    });
    document.getElementById('groupSelect').addEventListener('change', function () {
      onGroupChange(this.value);
    });
    document.getElementById('detailCloseBtn').addEventListener('click', closeDetail);
    document.getElementById('detailOverlay').addEventListener('click', function (event) {
      if (event.target === this) closeDetail();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDetail();
    });
  }

  async function init() {
    await waitForDb();
    await refreshCurrentUser();
    currentUser = checkLogin();
    if (!currentUser) return;
    if (!(await guardModuleAccess(mode))) return;

    try {
      summaryContext = await ExcellentHomework.loadAccessContext(mode);
      readingContext = await ReadingMedia.loadContext(mode);
      var semesterResult = await window.db
        .from('semesters')
        .select('semester_name')
        .eq('id', summaryContext.semesterId)
        .single();
      if (semesterResult.error) throw semesterResult.error;
      setCurrentSemester(
        'semesterName',
        semesterResult.data ? semesterResult.data.semester_name : '当前学期',
        'tag-lg'
      );
      document.getElementById('reporterName').textContent = currentUser.name || '未知';

      accessibleGroups = getAccessibleGroups();
      if (!accessibleGroups.length) {
        renderOrganizationSelector(null);
        renderCurrentPath(null);
        showWeekMessage('当前账号在本学期没有可查看的下属小组');
        document.body.classList.remove('app-loading');
        return;
      }

      eligibleHomeworkSchedules = await ExcellentHomework.loadEligibleSchedules(summaryContext);
      var detectedGroup = await resolveCurrentUserGroup();
      currentGroup =
        accessibleGroups.find(function (group) {
          return detectedGroup && Number(group.id) === Number(detectedGroup.id);
        }) || accessibleGroups[0];
      renderOrganizationSelector(currentGroup);
      renderCurrentPath(currentGroup);
      await loadWeek();
    } catch (error) {
      showWeekMessage('汇总加载失败：' + (error.message || error));
    } finally {
      document.body.classList.remove('app-loading');
    }
  }

  function startOfWeek(date) {
    var value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = value.getDay();
    var offset = day === 0 ? -6 : 1 - day;
    value.setDate(value.getDate() + offset);
    return value;
  }

  function addDays(date, days) {
    var value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    value.setDate(value.getDate() + days);
    return value;
  }

  function toDateString(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function formatMonthDay(date) {
    return date.getMonth() + 1 + '月' + date.getDate() + '日';
  }

  function formatWeekRange(start) {
    var end = addDays(start, 6);
    if (start.getFullYear() !== end.getFullYear()) {
      return (
        start.getFullYear() + '年' + formatMonthDay(start) + ' — ' + end.getFullYear() + '年' + formatMonthDay(end)
      );
    }
    if (start.getMonth() !== end.getMonth()) {
      return start.getFullYear() + '年' + formatMonthDay(start) + ' — ' + formatMonthDay(end);
    }
    return (
      start.getFullYear() + '年' + (start.getMonth() + 1) + '月' + start.getDate() + '日 — ' + end.getDate() + '日'
    );
  }

  function getWeekPositionLabel(start) {
    var current = startOfWeek(new Date());
    var diff = Math.round((start.getTime() - current.getTime()) / 86400000 / 7);
    if (diff === 0) return '本周';
    if (diff === -1) return '上周';
    if (diff === 1) return '下周';
    return diff < 0 ? Math.abs(diff) + '周前' : diff + '周后';
  }

  function renderWeekHeader() {
    var end = addDays(weekStart, 6);
    var range = formatWeekRange(weekStart);
    document.getElementById('weekRange').textContent = range;
    document.getElementById('currentDate').textContent = formatMonthDay(weekStart) + '—' + formatMonthDay(end);
    document.getElementById('currentWeekday').textContent = getWeekPositionLabel(weekStart);
  }

  async function resolveCurrentUserGroup() {
    var orgs = summaryContext.orgs || [];
    if (currentUser.phone) {
      var personResult = await window.db.from('people').select('id').eq('phone', currentUser.phone).maybeSingle();
      if (personResult.error) throw personResult.error;
      if (personResult.data) {
        var assignmentResult = await window.db
          .from('person_org_assignments')
          .select('org_id,sort_order')
          .eq('semester_id', summaryContext.semesterId)
          .eq('person_id', personResult.data.id)
          .eq('org_level', '小组')
          .eq('status', 'active')
          .order('sort_order')
          .limit(1);
        if (assignmentResult.error) throw assignmentResult.error;
        var assignment = (assignmentResult.data || [])[0];
        var assignedGroup = assignment ? ExcellentHomework.getOrg(orgs, assignment.org_id) : null;
        if (assignedGroup && assignedGroup.level === '小组') return assignedGroup;
      }
    }
    var membershipGroup = (summaryContext.memberships || [])
      .map(function (membership) {
        return ExcellentHomework.getOrg(orgs, membership.org_id);
      })
      .find(function (org) {
        return org && org.level === '小组';
      });
    if (membershipGroup) return membershipGroup;
    return (
      (summaryContext.scopes || []).find(function (org) {
        return org && org.level === '小组';
      }) || null
    );
  }

  function getAccessibleGroups() {
    var groups = [];
    (summaryContext.scopes || []).forEach(function (scope) {
      ExcellentHomework.getGroupsForScope(summaryContext.orgs, scope.id).forEach(function (group) {
        if (
          !groups.some(function (item) {
            return Number(item.id) === Number(group.id);
          })
        ) {
          groups.push(group);
        }
      });
    });
    return groups.sort(function (a, b) {
      return (
        (a.sort_order || 0) - (b.sort_order || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')
      );
    });
  }

  function uniqueOrgs(orgs) {
    var seen = {};
    return orgs.filter(function (org) {
      if (!org || seen[org.id]) return false;
      seen[org.id] = true;
      return true;
    });
  }

  function getClassesForBigClass(bigClassId) {
    return uniqueOrgs(
      accessibleGroups.map(function (group) {
        var classOrg = ExcellentHomework.getOrg(summaryContext.orgs, group.parent_id);
        return classOrg && Number(classOrg.parent_id) === Number(bigClassId) ? classOrg : null;
      })
    );
  }

  function getGroupsForClass(classId) {
    return accessibleGroups.filter(function (group) {
      return Number(group.parent_id) === Number(classId);
    });
  }

  function renderOptions(select, orgs, placeholder) {
    select.innerHTML =
      (orgs.length === 1 ? '' : '<option value="">' + placeholder + '</option>') +
      orgs
        .map(function (org) {
          return '<option value="' + org.id + '">' + escapeHtml(org.name) + '</option>';
        })
        .join('');
  }

  function renderOrganizationSelector(defaultGroup) {
    var bigClassSelect = document.getElementById('bigClassSelect');
    var classSelect = document.getElementById('classSelect');
    var groupSelect = document.getElementById('groupSelect');
    var bigClasses = uniqueOrgs(
      accessibleGroups.map(function (group) {
        var classOrg = ExcellentHomework.getOrg(summaryContext.orgs, group.parent_id);
        return classOrg ? ExcellentHomework.getOrg(summaryContext.orgs, classOrg.parent_id) : null;
      })
    );
    renderOptions(bigClassSelect, bigClasses, '请选择');
    if (!defaultGroup) {
      classSelect.innerHTML = '<option value="">--</option>';
      groupSelect.innerHTML = '<option value="">--</option>';
      return;
    }
    var classOrg = ExcellentHomework.getOrg(summaryContext.orgs, defaultGroup.parent_id);
    var bigClass = classOrg ? ExcellentHomework.getOrg(summaryContext.orgs, classOrg.parent_id) : null;
    if (!classOrg || !bigClass) return;
    bigClassSelect.value = String(bigClass.id);
    renderOptions(classSelect, getClassesForBigClass(bigClass.id), '请选择');
    classSelect.value = String(classOrg.id);
    renderOptions(groupSelect, getGroupsForClass(classOrg.id), '请选择');
    groupSelect.value = String(defaultGroup.id);
  }

  function onBigClassChange(bigClassId) {
    currentGroup = null;
    renderCurrentPath(null);
    var classes = bigClassId ? getClassesForBigClass(bigClassId) : [];
    var classSelect = document.getElementById('classSelect');
    var groupSelect = document.getElementById('groupSelect');
    renderOptions(classSelect, classes, '请选择');
    groupSelect.innerHTML = '<option value="">请选择</option>';
    if (classes.length === 1) {
      classSelect.value = String(classes[0].id);
      onClassChange(classes[0].id);
    } else {
      showWeekMessage('请选择班级和小组');
    }
  }

  function onClassChange(classId) {
    currentGroup = null;
    renderCurrentPath(null);
    var groups = classId ? getGroupsForClass(classId) : [];
    var groupSelect = document.getElementById('groupSelect');
    renderOptions(groupSelect, groups, '请选择');
    if (groups.length === 1) {
      groupSelect.value = String(groups[0].id);
      onGroupChange(groups[0].id);
    } else {
      showWeekMessage('请选择小组查看周汇总');
    }
  }

  function onGroupChange(groupId) {
    currentGroup =
      accessibleGroups.find(function (group) {
        return Number(group.id) === Number(groupId);
      }) || null;
    renderCurrentPath(currentGroup);
    if (!currentGroup) {
      showWeekMessage('请选择小组查看周汇总');
      return;
    }
    loadWeek();
  }

  function renderCurrentPath(group) {
    var classOrg = group ? ExcellentHomework.getOrg(summaryContext.orgs, group.parent_id) : null;
    var bigClass = classOrg ? ExcellentHomework.getOrg(summaryContext.orgs, classOrg.parent_id) : null;
    document.getElementById('bigClassName').textContent = bigClass ? bigClass.name : '--';
    document.getElementById('className').textContent = classOrg ? classOrg.name : '--';
    document.getElementById('groupName').textContent = group ? group.name : '--';
  }

  function setWeekButtonsDisabled(disabled) {
    document.getElementById('previousWeekBtn').disabled = disabled;
    document.getElementById('nextWeekBtn').disabled = disabled;
    document.getElementById('currentWeekBtn').disabled = disabled;
  }

  function changeWeek(days) {
    if (isLoadingWeek) return;
    weekStart = addDays(weekStart, days);
    loadWeek();
  }

  async function loadWeek() {
    if (!currentGroup || isLoadingWeek) return;
    isLoadingWeek = true;
    setWeekButtonsDisabled(true);
    renderWeekHeader();
    document.getElementById('weekSummaryText').textContent = '正在加载...';
    document.getElementById('scheduleList').innerHTML =
      '<div class="week-loading">正在加载' + escapeHtml(currentGroup.name) + '的周日程...</div>';

    try {
      var startString = toDateString(weekStart);
      var endString = toDateString(addDays(weekStart, 6));
      var groupId = Number(currentGroup.id);
      var dabanId = ExcellentHomework.getDabanId(summaryContext.orgs, groupId);
      var homeworkSchedules = eligibleHomeworkSchedules.filter(function (schedule) {
        return (
          Number(schedule.org_id) === Number(dabanId) &&
          schedule.schedule_date >= startString &&
          schedule.schedule_date <= endString
        );
      });

      var readingScheduleResult = await window.db
        .from('study_schedule_instances')
        .select('*')
        .eq('semester_id', summaryContext.semesterId)
        .gte('schedule_date', startString)
        .lte('schedule_date', endString)
        .order('schedule_date')
        .order('scope_level')
        .order('org_id');
      if (readingScheduleResult.error) throw readingScheduleResult.error;
      var readingSchedules = (readingScheduleResult.data || []).filter(function (schedule) {
        return ReadingMedia.canAccessRelatedOrg(readingContext, schedule.org_id);
      });

      var readingByDate = {};
      readingSchedules.forEach(function (schedule) {
        if (!readingByDate[schedule.schedule_date]) readingByDate[schedule.schedule_date] = [];
        readingByDate[schedule.schedule_date].push(schedule);
      });

      var relevantReadingSchedules = [];
      Object.keys(readingByDate).forEach(function (dateString) {
        var found = ReadingMedia.findScheduleForSourceOrg(
          readingByDate[dateString],
          currentGroup,
          readingContext.orgMap
        );
        if (found) relevantReadingSchedules.push(found);
      });

      var homeworkIds = homeworkSchedules.map(function (schedule) {
        return Number(schedule.id);
      });
      var readingIds = relevantReadingSchedules.map(function (schedule) {
        return Number(schedule.id);
      });

      var homeworkEntriesPromise = homeworkIds.length
        ? window.db
            .from('excellent_homework_entries')
            .select('*')
            .eq('semester_id', summaryContext.semesterId)
            .eq('org_id', groupId)
            .in('schedule_id', homeworkIds)
            .order('slot_index')
        : Promise.resolve({ data: [], error: null });
      var assetsPromise = readingIds.length
        ? window.db
            .from('study_reading_media_assets')
            .select('*')
            .eq('semester_id', summaryContext.semesterId)
            .eq('source_org_id', groupId)
            .in('schedule_instance_id', readingIds)
            .order('sort_order')
            .order('id')
        : Promise.resolve({ data: [], error: null });
      var cardsPromise =
        isPublicity && homeworkIds.length
          ? window.db
              .from('publicity_homework_cards')
              .select('*')
              .eq('semester_id', summaryContext.semesterId)
              .eq('org_id', groupId)
              .in('schedule_id', homeworkIds)
          : Promise.resolve({ data: [], error: null });
      var postersPromise =
        isPublicity && readingIds.length
          ? window.db
              .from('publicity_reading_posters')
              .select('*')
              .eq('semester_id', summaryContext.semesterId)
              .eq('source_org_id', groupId)
              .in('schedule_instance_id', readingIds)
          : Promise.resolve({ data: [], error: null });

      var results = await Promise.all([homeworkEntriesPromise, assetsPromise, cardsPromise, postersPromise]);
      results.forEach(function (result) {
        if (result.error) throw result.error;
      });

      buildWeekRecords({
        homeworkSchedules: homeworkSchedules,
        readingSchedules: relevantReadingSchedules,
        entries: results[0].data || [],
        assets: results[1].data || [],
        cards: results[2].data || [],
        posters: results[3].data || []
      });
      renderScheduleList();
    } catch (error) {
      showWeekMessage('周汇总加载失败：' + (error.message || error));
    } finally {
      isLoadingWeek = false;
      setWeekButtonsDisabled(false);
    }
  }

  function buildWeekRecords(data) {
    weekRecords = {};
    for (var offset = 0; offset < 7; offset += 1) {
      var date = addDays(weekStart, offset);
      var dateString = toDateString(date);
      var homeworkSchedule =
        data.homeworkSchedules.find(function (schedule) {
          return schedule.schedule_date === dateString;
        }) || null;
      var readingSchedule =
        data.readingSchedules.find(function (schedule) {
          return schedule.schedule_date === dateString;
        }) || null;
      var entries = homeworkSchedule
        ? data.entries.filter(function (entry) {
            return Number(entry.schedule_id) === Number(homeworkSchedule.id);
          })
        : [];
      var assets = readingSchedule
        ? data.assets.filter(function (asset) {
            return Number(asset.schedule_instance_id) === Number(readingSchedule.id);
          })
        : [];
      var card = homeworkSchedule
        ? data.cards.find(function (item) {
            return Number(item.schedule_id) === Number(homeworkSchedule.id);
          }) || null
        : null;
      var poster = readingSchedule
        ? data.posters.find(function (item) {
            return Number(item.schedule_instance_id) === Number(readingSchedule.id);
          }) || null
        : null;
      weekRecords[dateString] = {
        date: date,
        dateString: dateString,
        homeworkSchedule: homeworkSchedule,
        readingSchedule: readingSchedule,
        entries: entries,
        assets: assets,
        card: card,
        poster: poster
      };
    }
  }

  function getScheduleTitle(record) {
    if (!isPublicity) return record.homeworkSchedule ? '优秀作业日程' : '当日无作业日程';
    if (record.homeworkSchedule && record.readingSchedule) return '优秀作业与共读影像';
    if (record.homeworkSchedule) return '优秀作业卡片';
    if (record.readingSchedule) return '每日共读影像';
    return '当日无宣委日程';
  }

  function getScheduleMeta(record) {
    var parts = [];
    if (record.homeworkSchedule) parts.push('作业考核');
    if (record.readingSchedule) {
      parts.push(ReadingMedia.getScopeLabel(record.readingSchedule.scope_level));
    }
    return parts.length ? parts.join(' · ') : '没有需要汇总的内容';
  }

  function renderContentTags(record) {
    var tags = [];
    if (record.homeworkSchedule) {
      var homeworkComplete = record.entries.length === 3;
      var label = isPublicity ? '作业卡片 ' : '优秀作业 ';
      label += record.entries.length ? record.entries.length + '篇' : '待填报';
      tags.push(
        '<span class="content-tag ' + (homeworkComplete ? 'complete' : 'pending') + '">' + escapeHtml(label) + '</span>'
      );
    }
    if (isPublicity && record.readingSchedule) {
      tags.push(
        '<span class="content-tag media ' +
          (record.assets.length ? 'complete' : 'pending') +
          '">共读影像 ' +
          (record.assets.length ? record.assets.length + '张' : '待提交') +
          '</span>'
      );
    }
    return tags.join('');
  }

  function renderScheduleList() {
    var todayString = toDateString(new Date());
    var availableCount = 0;
    var contentCount = 0;
    var html = '';

    Object.keys(weekRecords)
      .sort()
      .forEach(function (dateString) {
        var record = weekRecords[dateString];
        var available = isPublicity ? !!(record.homeworkSchedule || record.readingSchedule) : !!record.homeworkSchedule;
        if (available) availableCount += 1;
        contentCount += record.entries.length + (isPublicity ? record.assets.length : 0);
        var isToday = dateString === todayString;
        html +=
          '<button class="schedule-item' +
          (isToday ? ' today' : '') +
          '" type="button" data-date="' +
          dateString +
          '"' +
          (available ? '' : ' disabled') +
          '><span class="date-tile"><strong class="date-day">' +
          record.date.getDate() +
          '</strong><span class="date-weekday">' +
          weekdays[record.date.getDay()] +
          '</span></span><span class="schedule-copy"><span class="schedule-title-row"><span class="schedule-title">' +
          escapeHtml(getScheduleTitle(record)) +
          '</span>' +
          (isToday ? '<span class="today-tag">今天</span>' : '') +
          '</span><span class="schedule-meta">' +
          escapeHtml(getScheduleMeta(record)) +
          '</span><span class="schedule-tags">' +
          renderContentTags(record) +
          '</span></span><span class="schedule-chevron" data-icon="ChevronRightIcon"></span></button>';
      });

    document.getElementById('scheduleList').innerHTML = html;
    document.getElementById('weekSummaryText').textContent =
      '本周 ' + availableCount + ' 个日程 · ' + contentCount + (isPublicity ? ' 项内容' : ' 篇作业');
    document.querySelectorAll('.schedule-item[data-date]:not(:disabled)').forEach(function (button) {
      button.addEventListener('click', function () {
        lastDetailTrigger = this;
        openDayDetail(this.getAttribute('data-date'));
      });
    });
    if (window.renderIcons) window.renderIcons(document.getElementById('scheduleList'));
  }

  function showWeekMessage(message) {
    document.getElementById('weekSummaryText').textContent = '';
    document.getElementById('scheduleList').innerHTML = '<div class="week-empty">' + escapeHtml(message) + '</div>';
  }

  async function openDayDetail(dateString) {
    var record = weekRecords[dateString];
    if (!record) return;
    var overlay = document.getElementById('detailOverlay');
    document.getElementById('detailTitle').textContent =
      formatMonthDay(record.date) + ' · ' + weekdays[record.date.getDay()];
    document.getElementById('detailSubtitle').textContent = ReadingMedia.getOrgPath(
      currentGroup.id,
      readingContext.orgMap
    );
    document.getElementById('detailBody').innerHTML = '<div class="week-loading">正在加载日程内容...</div>';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('detail-open');
    document.getElementById('detailCloseBtn').focus();

    try {
      var detailHtml = renderHomeworkDetail(record);
      if (isPublicity && record.readingSchedule) {
        var bundle = await ReadingMedia.loadScheduleBundle(record.readingSchedule, currentGroup.id);
        detailHtml += renderReadingDetail(record, bundle);
      }
      document.getElementById('detailBody').innerHTML =
        detailHtml || '<div class="detail-empty">该日程暂无已提交内容</div>';
      bindPublicityContentCards(record);
      if (window.renderIcons) window.renderIcons(document.getElementById('detailBody'));
    } catch (error) {
      document.getElementById('detailBody').innerHTML =
        '<div class="detail-empty">日程内容加载失败：' + escapeHtml(error.message || error) + '</div>';
    }
  }

  function getPublicityStatus(item) {
    if (!item) return { text: '待制作', className: 'draft' };
    if (item.status === 'published') return { text: '已发布', className: '' };
    if (item.status === 'ready') return { text: '已就绪', className: '' };
    return { text: '草稿', className: 'draft' };
  }

  function renderHomeworkDetail(record) {
    if (!record.homeworkSchedule) return '';
    var status = isPublicity
      ? getPublicityStatus(record.card)
      : {
          text: record.entries.length === 3 ? '已填报' : '待完善',
          className: record.entries.length === 3 ? '' : 'draft'
        };
    var title = isPublicity && record.card && record.card.title ? record.card.title : '优秀作业';
    var note =
      isPublicity && record.card && record.card.subtitle
        ? '<div class="detail-note">' + escapeHtml(record.card.subtitle) + '</div>'
        : '';
    if (isPublicity) {
      return renderPublicityContentCard({
        kind: 'homework',
        icon: 'TrophyIcon',
        title: title,
        status: status,
        description: record.entries.length
          ? '已收录 ' + record.entries.length + ' 篇优秀作业，进入后可编辑卡片内容与版式。'
          : '暂未收录优秀作业，进入制作页后可继续完善。',
        action: record.card ? '继续制作优秀作业卡片' : '制作优秀作业卡片',
        scheduleId: record.homeworkSchedule.id
      });
    }
    var entriesHtml = record.entries.length
      ? '<div class="homework-entry-list">' +
        record.entries
          .slice()
          .sort(function (a, b) {
            return Number(a.slot_index) - Number(b.slot_index);
          })
          .map(function (entry) {
            return (
              '<article class="homework-entry-card"><div class="entry-meta"><strong class="entry-person">' +
              escapeHtml(entry.person_name_snapshot || '未命名成员') +
              '</strong><span class="entry-index">优秀作业 ' +
              Number(entry.slot_index || 0) +
              '</span></div><div class="entry-content">' +
              escapeHtml(entry.content || '') +
              '</div></article>'
            );
          })
          .join('') +
        '</div>'
      : '<div class="detail-empty">该日程暂未填报优秀作业</div>';

    return (
      '<section class="detail-section"><div class="detail-section-head"><div class="detail-section-name">' +
      '<span data-icon="TrophyIcon"></span><span>' +
      escapeHtml(title) +
      '</span></div><span class="detail-status ' +
      status.className +
      '">' +
      status.text +
      '</span></div>' +
      note +
      entriesHtml +
      '</section>'
    );
  }

  function getAssetTitle(asset) {
    if (asset.asset_kind === 'role') {
      return (
        (asset.role_name_snapshot || '岗位') + (asset.person_name_snapshot ? ' · ' + asset.person_name_snapshot : '')
      );
    }
    if (asset.asset_kind === 'overview') return '全员画面';
    if (asset.asset_kind === 'moment') return '现场花絮';
    return '共读影像';
  }

  function renderReadingDetail(record, bundle) {
    var status = getPublicityStatus(record.poster);
    var assets = bundle.assets || [];
    var title =
      record.poster && record.poster.title
        ? record.poster.title
        : (bundle.readingType && bundle.readingType.type_name) || '每日共读影像';
    return renderPublicityContentCard({
      kind: 'reading',
      icon: 'ImagesIcon',
      title: title,
      status: status,
      description: assets.length
        ? '已汇集 ' + assets.length + ' 张晨读影像，进入后可编排海报与裁切画面。'
        : '暂未提交晨读影像，进入制作页后可继续补充。',
      action: record.poster ? '继续制作每日共读影像' : '制作每日共读影像',
      scheduleId: record.readingSchedule.id
    });
  }

  function renderPublicityContentCard(item) {
    return '<button class="production-content-card ' + escapeHtml(item.kind) + '" type="button" data-editor-kind="' +
      escapeHtml(item.kind) + '" data-schedule-id="' + Number(item.scheduleId) + '"><span class="production-card-icon" data-icon="' +
      escapeHtml(item.icon) + '"></span><span class="production-card-copy"><span class="production-card-top"><strong>' +
      escapeHtml(item.title) + '</strong><span class="detail-status ' + item.status.className + '">' +
      escapeHtml(item.status.text) + '</span></span><span>' + escapeHtml(item.description) +
      '</span></span><span class="production-card-action">' + escapeHtml(item.action) +
      '<span data-icon="ChevronRightIcon"></span></span></button>';
  }

  function bindPublicityContentCards(record) {
    if (!isPublicity) return;
    document.querySelectorAll('.production-content-card[data-editor-kind]').forEach(function(button) {
      button.addEventListener('click', function() {
        var kind = this.getAttribute('data-editor-kind');
        var scheduleId = this.getAttribute('data-schedule-id');
        var target = kind === 'reading' ? 'publicity-reading-media.html' : 'publicity-homework-card.html';
        var query = new URLSearchParams({
          from: 'publicity-summary',
          date: record.dateString,
          group_id: String(currentGroup.id),
          schedule_id: String(scheduleId)
        });
        location.href = target + '?' + query.toString();
      });
    });
  }

  function closeDetail() {
    var overlay = document.getElementById('detailOverlay');
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('detail-open');
    if (lastDetailTrigger) lastDetailTrigger.focus();
  }
})();
