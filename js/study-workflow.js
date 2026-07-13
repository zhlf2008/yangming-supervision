// ============================================================
// 学委工作流共享工具：组织权限、日程生成、内容继承、岗位摊派
// ============================================================

var StudyWorkflow = (function () {
  var LEVEL_RANK = { 大班: 1, 班级: 2, 小组: 3 };
  var SCOPE_LABELS = { 大班: '大班共读', 班级: '班级共读', 小组: '小组共读' };
  var STUDY_ROLES = ['学委', '副学委', '管理员', 'admin', 'manager'];

  function swfNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function swfIsPlatformAdmin(user) {
    return !!user && (user.role === '超级管理员' || user.role === '管理员');
  }

  function swfOrgMap(orgs) {
    var map = {};
    (orgs || []).forEach(function (org) {
      map[Number(org.id)] = org;
    });
    return map;
  }

  function swfGetOrg(orgs, id) {
    var num = swfNumber(id);
    if (!num) return null;
    return (orgs || []).find(function (org) {
      return Number(org.id) === num;
    }) || null;
  }

  function swfGetAncestors(orgId, orgs) {
    var map = swfOrgMap(orgs);
    var current = map[Number(orgId)];
    var chain = [];
    while (current) {
      chain.unshift(current);
      current = current.parent_id ? map[Number(current.parent_id)] : null;
    }
    return chain;
  }

  function swfGetAncestorIds(orgId, orgs) {
    return swfGetAncestors(orgId, orgs).map(function (org) {
      return Number(org.id);
    });
  }

  function swfGetDescendantIds(orgId, orgs, includeSelf) {
    var rootId = swfNumber(orgId);
    if (!rootId) return [];
    var result = includeSelf === false ? [] : [rootId];
    function walk(parentId) {
      (orgs || []).forEach(function (org) {
        if (Number(org.parent_id) === Number(parentId)) {
          result.push(Number(org.id));
          walk(org.id);
        }
      });
    }
    walk(rootId);
    return result;
  }

  function swfGetBigClassId(orgId, orgs) {
    var chain = swfGetAncestors(orgId, orgs);
    var found = chain.find(function (org) {
      return org.level === '大班';
    });
    return found ? Number(found.id) : null;
  }

  function swfGetClassId(orgId, orgs) {
    var chain = swfGetAncestors(orgId, orgs);
    var found = chain.find(function (org) {
      return org.level === '班级';
    });
    return found ? Number(found.id) : null;
  }

  function swfGetOrgPath(orgId, orgs) {
    return swfGetAncestors(orgId, orgs).map(function (org) {
      return org.name;
    }).join(' / ');
  }

  function swfGetOrgLevel(orgId, orgs) {
    var org = swfGetOrg(orgs, orgId);
    return org ? org.level : '';
  }

  function swfSortOrgs(orgs) {
    return (orgs || []).slice().sort(function (a, b) {
      var ra = LEVEL_RANK[a.level] || 9;
      var rb = LEVEL_RANK[b.level] || 9;
      if (ra !== rb) return ra - rb;
      if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0);
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
    });
  }

  function swfIsStudyAdminMembership(membership) {
    if (!membership) return false;
    return ['管理员', 'admin', 'manager'].indexOf(membership.role) !== -1;
  }

  function swfMembershipOrgIds(memberships) {
    return (memberships || []).map(function (m) {
      return swfNumber(m.org_id);
    }).filter(Boolean);
  }

  async function swfLoadContext(semesterId, orgs) {
    var user = getCurrentUser();
    var isPlatformAdmin = swfIsPlatformAdmin(user);
    var memberships = [];
    if (!isPlatformAdmin && user && semesterId) {
      var result = await window.db
        .from('module_memberships')
        .select('id,role,org_id')
        .eq('user_id', user.id)
        .eq('semester_id', semesterId)
        .eq('module_key', 'study')
        .eq('enabled', true);
      memberships = result.data || [];
    }

    var membershipOrgIds = swfMembershipOrgIds(memberships);
    var fullStudyAccess = isPlatformAdmin || memberships.some(function (m) {
      return swfIsStudyAdminMembership(m) && !m.org_id;
    });

    var primaryOrgId = null;
    if (membershipOrgIds.length) {
      membershipOrgIds.sort(function (a, b) {
        var oa = swfGetOrg(orgs, a);
        var ob = swfGetOrg(orgs, b);
        return (LEVEL_RANK[oa && oa.level] || 9) - (LEVEL_RANK[ob && ob.level] || 9);
      });
      primaryOrgId = membershipOrgIds[0];
    } else if (user && user.organization_id) {
      primaryOrgId = swfNumber(user.organization_id);
    }

    var manageableOrgIds = [];
    if (fullStudyAccess) {
      manageableOrgIds = (orgs || []).map(function (org) { return Number(org.id); });
    } else if (primaryOrgId) {
      // 下级组织可管理；所属路径上的上级组织仅用于查看规则、日程来源和已下发任务。
      manageableOrgIds = swfGetDescendantIds(primaryOrgId, orgs, true)
        .concat(swfGetAncestorIds(primaryOrgId, orgs))
        .filter(function(id, index, values) { return values.indexOf(id) === index; });
    }

    return {
      user: user,
      isPlatformAdmin: isPlatformAdmin,
      fullStudyAccess: fullStudyAccess,
      memberships: memberships,
      membershipOrgIds: membershipOrgIds,
      primaryOrgId: primaryOrgId,
      primaryOrgLevel: swfGetOrgLevel(primaryOrgId, orgs),
      bigClassId: primaryOrgId ? swfGetBigClassId(primaryOrgId, orgs) : null,
      classId: primaryOrgId ? swfGetClassId(primaryOrgId, orgs) : null,
      manageableOrgIds: manageableOrgIds
    };
  }

  function swfHasMembershipAt(context, orgId) {
    var id = swfNumber(orgId);
    if (!id) return false;
    if (context.fullStudyAccess || context.isPlatformAdmin) return true;
    return context.membershipOrgIds.indexOf(id) !== -1 || Number(context.primaryOrgId) === id;
  }

  function swfCanViewOrg(context, orgId) {
    if (!context) return false;
    if (context.fullStudyAccess || context.isPlatformAdmin) return true;
    return context.manageableOrgIds.indexOf(Number(orgId)) !== -1;
  }

  function swfCanManageOrg(context, orgId, orgs) {
    var id = swfNumber(orgId);
    if (!context || !id) return false;
    if (context.fullStudyAccess || context.isPlatformAdmin) return true;
    var ancestorIds = swfGetAncestorIds(id, orgs);
    return context.membershipOrgIds.some(function(membershipOrgId) {
      return ancestorIds.indexOf(Number(membershipOrgId)) !== -1;
    });
  }

  function swfCanEditRulesForBigClass(context, bigClassId) {
    var id = swfNumber(bigClassId);
    if (!context || !id) return false;
    if (context.fullStudyAccess || context.isPlatformAdmin) return true;
    return swfHasMembershipAt(context, id);
  }

  function swfCanEditContent(context, schedule, orgs) {
    if (!context || !schedule) return false;
    var org = swfGetOrg(orgs, schedule.org_id);
    if (!org) return false;
    if (context.fullStudyAccess || context.isPlatformAdmin) return true;
    if (!swfHasMembershipAt(context, org.id)) return false;
    if (schedule.scope_level === '大班') return org.level === '大班';
    if (schedule.scope_level === '班级') return org.level === '大班' || org.level === '班级';
    if (schedule.scope_level === '小组') return org.level === '大班' || org.level === '班级' || org.level === '小组';
    return false;
  }

  function swfCanManageDemand(context, schedule, orgs) {
    if (!context || !schedule) return false;
    var org = swfGetOrg(orgs, schedule.org_id);
    if (!org) return false;
    if (context.fullStudyAccess || context.isPlatformAdmin) return true;
    return swfHasMembershipAt(context, org.id);
  }

  function swfDateToString(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function swfGetWeekday(dateStr) {
    var date = new Date(dateStr + 'T00:00:00');
    return date.getDay() || 7;
  }

  function swfSemesterStartDate(semester) {
    return semester.trial_start_date || semester.start_date;
  }

  function swfBuildScheduleRows(semester, bigClassId, rules, orgs) {
    var rows = [];
    if (!semester || !bigClassId || !rules || !rules.length) return rows;
    var targetOrgIds = swfGetDescendantIds(bigClassId, orgs, true);
    var targetOrgs = swfSortOrgs((orgs || []).filter(function (org) {
      return targetOrgIds.indexOf(Number(org.id)) !== -1 && org.is_active !== false;
    }));
    var start = new Date(swfSemesterStartDate(semester) + 'T00:00:00');
    var end = new Date(semester.end_date + 'T00:00:00');
    while (start <= end) {
      var dateStr = swfDateToString(start);
      var weekday = start.getDay() || 7;
      var rule = rules.find(function (item) {
        return Number(item.weekday) === weekday && item.is_active !== false;
      });
      if (rule) {
        targetOrgs.forEach(function (org) {
          rows.push({
            semester_id: Number(semester.id),
            schedule_date: dateStr,
            scope_level: rule.scope_level,
            reading_type_id: rule.reading_type_id ? Number(rule.reading_type_id) : null,
            org_id: Number(org.id),
            note: rule.title || ''
          });
        });
      }
      start.setDate(start.getDate() + 1);
    }
    return rows;
  }

  async function swfGenerateSchedulesForBigClass(options) {
    var opts = options || {};
    var rows = swfBuildScheduleRows(opts.semester, opts.bigClassId, opts.rules || [], opts.orgs || []);
    if (!rows.length) return { count: 0 };
    for (var i = 0; i < rows.length; i += 80) {
      var batch = rows.slice(i, i + 80);
      var result = await window.db.from('study_schedule_instances').upsert(batch, {
        onConflict: 'semester_id,schedule_date,scope_level,org_id',
        ignoreDuplicates: false
      });
      if (result.error) throw result.error;
    }
    return { count: rows.length };
  }

  function swfContentHasValue(content) {
    return !!content && !!(
      content.course_id ||
      content.custom_title ||
      content.custom_theme ||
      content.custom_content ||
      content.custom_question ||
      content.custom_paper_pages ||
      content.custom_ebook_url
    );
  }

  function swfGetContentChain(schedule, orgs, schedules) {
    if (!schedule) return [];
    var ancestorIds = swfGetAncestorIds(schedule.org_id, orgs);
    var allowed = ancestorIds;
    if (schedule.scope_level === '大班') allowed = ancestorIds.filter(function (id) {
      return swfGetOrgLevel(id, orgs) === '大班';
    });
    if (schedule.scope_level === '班级') allowed = ancestorIds.filter(function (id) {
      var level = swfGetOrgLevel(id, orgs);
      return level === '大班' || level === '班级';
    });
    return (schedules || []).filter(function (item) {
      return item.schedule_date === schedule.schedule_date &&
        item.scope_level === schedule.scope_level &&
        allowed.indexOf(Number(item.org_id)) !== -1;
    }).sort(function (a, b) {
      return allowed.indexOf(Number(b.org_id)) - allowed.indexOf(Number(a.org_id));
    });
  }

  function swfExtractContent(schedule, content) {
    var source = content || schedule || {};
    return {
      schedule_id: schedule ? schedule.id : null,
      content_id: content ? content.id : null,
      org_id: content ? content.org_id : (schedule ? schedule.org_id : null),
      course_id: source.course_id || null,
      custom_title: source.custom_title || '',
      custom_theme: source.custom_theme || '',
      custom_content: source.custom_content || '',
      custom_question: source.custom_question || '',
      custom_paper_pages: source.custom_paper_pages || '',
      custom_ebook_url: source.custom_ebook_url || '',
      note: source.note || ''
    };
  }

  function swfResolveContent(schedule, orgs, schedules, contentByScheduleId, coursesById) {
    var chain = swfGetContentChain(schedule, orgs, schedules);
    var chosen = null;
    var sourceSchedule = null;
    for (var i = 0; i < chain.length; i++) {
      var item = chain[i];
      var content = contentByScheduleId ? contentByScheduleId[Number(item.id)] : null;
      if (swfContentHasValue(content)) {
        chosen = swfExtractContent(item, content);
        sourceSchedule = item;
        break;
      }
      if (!chosen && swfContentHasValue(item)) {
        chosen = swfExtractContent(item, null);
        sourceSchedule = item;
      }
    }
    if (!chosen) {
      chosen = swfExtractContent(schedule, null);
      sourceSchedule = schedule;
    }
    var course = chosen.course_id && coursesById ? coursesById[Number(chosen.course_id)] : null;
    chosen.title = chosen.custom_title || (course ? course.title : '');
    chosen.theme = chosen.custom_theme || (course ? course.theme : '');
    chosen.content = chosen.custom_content || (course ? course.study_content : '');
    chosen.question = chosen.custom_question || (course ? course.thinking_questions : '');
    chosen.paper_pages = chosen.custom_paper_pages || (course ? course.paper_pages : '');
    chosen.ebook_url = chosen.custom_ebook_url || (course ? course.ebook_url : '');
    chosen.source_schedule_id = sourceSchedule ? Number(sourceSchedule.id) : null;
    chosen.source_org_id = sourceSchedule ? Number(sourceSchedule.org_id) : null;
    chosen.source_org_name = sourceSchedule ? swfGetOrgPath(sourceSchedule.org_id, orgs) : '';
    return chosen;
  }

  async function swfUpsertScheduleContent(schedule, orgId, payload) {
    var user = getCurrentUser();
    var row = Object.assign({}, payload || {}, {
      schedule_instance_id: Number(schedule.id),
      org_id: Number(orgId || schedule.org_id)
    });
    if (user && user.id) row.created_by = user.id;
    var result = await window.db.from('study_schedule_content').upsert(row, {
      onConflict: 'schedule_instance_id,org_id'
    });
    if (result.error) throw result.error;
    return result;
  }

  function swfGetDemandTargets(schedule, orgs) {
    if (!schedule) return [];
    var org = swfGetOrg(orgs, schedule.org_id);
    if (!org) return [];
    if (org.level === '大班') {
      return swfSortOrgs((orgs || []).filter(function (item) {
        return item.level === '班级' && item.is_active !== false && Number(item.parent_id) === Number(org.id);
      }));
    }
    if (org.level === '班级') {
      return swfSortOrgs((orgs || []).filter(function (item) {
        return item.level === '小组' && item.is_active !== false && Number(item.parent_id) === Number(org.id);
      }));
    }
    if (org.level === '小组') {
      var clsId = org.parent_id;
      return swfSortOrgs((orgs || []).filter(function (item) {
        return item.level === '小组' && item.is_active !== false && Number(item.parent_id) === Number(clsId);
      }));
    }
    return [];
  }

  function swfGetTargetLevel(schedule, orgs) {
    var targets = swfGetDemandTargets(schedule, orgs);
    return targets.length ? targets[0].level : '小组';
  }

  function swfScopeLabel(scope) {
    return SCOPE_LABELS[scope] || scope || '';
  }

  function swfIsMissingSchemaError(error, names) {
    if (!error) return false;
    var haystack = [
      error.code,
      error.message,
      error.details,
      error.hint,
      error.description
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack) return false;
    if (
      haystack.indexOf('does not exist') !== -1 ||
      haystack.indexOf('could not find') !== -1 ||
      haystack.indexOf('schema cache') !== -1 ||
      haystack.indexOf('undefined column') !== -1 ||
      haystack.indexOf('undefined table') !== -1 ||
      haystack.indexOf('pgrst204') !== -1 ||
      haystack.indexOf('42p01') !== -1 ||
      haystack.indexOf('42703') !== -1
    ) {
      return true;
    }
    return (names || []).some(function (name) {
      return haystack.indexOf(String(name).toLowerCase()) !== -1;
    });
  }

  return {
    levelRank: LEVEL_RANK,
    studyRoles: STUDY_ROLES,
    isPlatformAdmin: swfIsPlatformAdmin,
    getOrg: swfGetOrg,
    getOrgPath: swfGetOrgPath,
    getOrgLevel: swfGetOrgLevel,
    getAncestors: swfGetAncestors,
    getAncestorIds: swfGetAncestorIds,
    getDescendantIds: swfGetDescendantIds,
    getBigClassId: swfGetBigClassId,
    getClassId: swfGetClassId,
    sortOrgs: swfSortOrgs,
    loadContext: swfLoadContext,
    canViewOrg: swfCanViewOrg,
    canManageOrg: swfCanManageOrg,
    canEditRulesForBigClass: swfCanEditRulesForBigClass,
    canEditContent: swfCanEditContent,
    canManageDemand: swfCanManageDemand,
    dateToString: swfDateToString,
    getWeekday: swfGetWeekday,
    buildScheduleRows: swfBuildScheduleRows,
    generateSchedulesForBigClass: swfGenerateSchedulesForBigClass,
    getContentChain: swfGetContentChain,
    resolveContent: swfResolveContent,
    upsertScheduleContent: swfUpsertScheduleContent,
    getDemandTargets: swfGetDemandTargets,
    getTargetLevel: swfGetTargetLevel,
    scopeLabel: swfScopeLabel,
    isMissingSchemaError: swfIsMissingSchemaError
  };
})();
