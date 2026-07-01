(function () {
  function isPlatformAdmin(profile) {
    return !!(profile && (profile.role === '超级管理员' || profile.role === '管理员'));
  }

  function getOrg(orgs, orgId) {
    return (orgs || []).find(function (org) {
      return Number(org.id) === Number(orgId);
    }) || null;
  }

  function getDabanId(orgs, orgId) {
    var current = getOrg(orgs, orgId);
    var guard = 0;
    while (current && current.level !== '大班' && guard < 5) {
      current = getOrg(orgs, current.parent_id);
      guard += 1;
    }
    return current && current.level === '大班' ? Number(current.id) : null;
  }

  function isOrgAncestor(orgs, ancestorId, orgId) {
    var current = getOrg(orgs, orgId);
    var guard = 0;
    while (current && guard < 5) {
      if (Number(current.id) === Number(ancestorId)) return true;
      current = getOrg(orgs, current.parent_id);
      guard += 1;
    }
    return false;
  }

  function compactScopes(orgs, scopes) {
    var unique = [];
    (scopes || []).forEach(function (scope) {
      if (!scope || unique.some(function (item) { return Number(item.id) === Number(scope.id); })) return;
      unique.push(scope);
    });
    return unique.filter(function (scope) {
      return !unique.some(function (candidate) {
        return Number(candidate.id) !== Number(scope.id) &&
          isOrgAncestor(orgs, candidate.id, scope.id);
      });
    }).sort(function (a, b) {
      var levelOrder = { '大班': 1, '班级': 2, '小组': 3 };
      var levelDiff = (levelOrder[a.level] || 9) - (levelOrder[b.level] || 9);
      if (levelDiff) return levelDiff;
      return (a.sort_order || 0) - (b.sort_order || 0) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
    });
  }

  function getGroupsForScope(orgs, scopeId) {
    var scope = getOrg(orgs, scopeId);
    if (!scope) return [];
    if (scope.level === '小组') return scope.is_active === false ? [] : [scope];
    return getAllGroups(Number(scope.id), orgs).filter(function (org) {
      return org.is_active !== false;
    }).sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
    });
  }

  function scheduleHasHomework(schedule, homeworkTypeIds) {
    var ids = String(schedule.item_ids || '').split(',').map(Number).filter(Boolean);
    return homeworkTypeIds.some(function (id) {
      return ids.indexOf(Number(id)) >= 0;
    });
  }

  function formatDate(dateText, includeYear) {
    var date = new Date(String(dateText) + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return dateText || '';
    var prefix = includeYear ? date.getFullYear() + '年' : '';
    return prefix + (date.getMonth() + 1) + '月' + date.getDate() + '日 ' +
      WEEKDAYS[date.getDay()];
  }

  function formatShortDate(dateText) {
    var date = new Date(String(dateText) + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return dateText || '';
    return (date.getMonth() + 1) + '/' + date.getDate();
  }

  async function loadAccessContext(moduleKey, options) {
    var profile = getCurrentUser();
    var semesterId = await getCurrentSemesterId();
    if (!profile || !semesterId) throw new Error('当前学期或登录信息不可用');

    var membershipRequest = isPlatformAdmin(profile)
      ? Promise.resolve({ data: [], error: null })
      : window.db.from('module_memberships')
        .select('id, org_id, role')
        .eq('user_id', profile.id)
        .eq('semester_id', semesterId)
        .eq('module_key', moduleKey)
        .eq('enabled', true);

    var results = await Promise.all([
      window.db.from('organizations')
        .select('id,name,level,parent_id,sort_order,is_active,semester_id')
        .eq('semester_id', semesterId)
        .eq('is_active', true)
        .order('sort_order')
        .order('id'),
      window.db.from('assessment_types')
        .select('id,type_name')
        .eq('semester_id', semesterId),
      membershipRequest
    ]);

    var orgResult = results[0];
    var typeResult = results[1];
    var membershipResult = results[2];
    if (orgResult.error) throw orgResult.error;
    if (typeResult.error) throw typeResult.error;
    if (membershipResult.error) throw membershipResult.error;

    var orgs = orgResult.data || [];
    var memberships = membershipResult.data || [];
    var adminAllOrgScopes = !!(options && options.adminAllOrgScopes);
    var scopes = isPlatformAdmin(profile)
      ? orgs.filter(function (org) {
        return adminAllOrgScopes || org.level === '大班';
      })
      : memberships.map(function (membership) {
        return getOrg(orgs, membership.org_id);
      }).filter(Boolean);
    scopes = adminAllOrgScopes
      ? scopes.sort(function (a, b) {
        var levelOrder = { '大班': 1, '班级': 2, '小组': 3 };
        return (levelOrder[a.level] || 9) - (levelOrder[b.level] || 9) ||
          (a.sort_order || 0) - (b.sort_order || 0) ||
          String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
      })
      : compactScopes(orgs, scopes);

    var homeworkTypeIds = (typeResult.data || []).filter(function (type) {
      return String(type.type_name || '').indexOf('作业') >= 0;
    }).map(function (type) {
      return Number(type.id);
    });

    return {
      profile: profile,
      semesterId: Number(semesterId),
      orgs: orgs,
      memberships: memberships,
      scopes: scopes,
      homeworkTypeIds: homeworkTypeIds
    };
  }

  async function loadEligibleSchedules(context) {
    var dabanIds = Array.from(new Set((context.scopes || []).map(function (scope) {
      return getDabanId(context.orgs, scope.id);
    }).filter(Boolean)));
    if (!dabanIds.length || !context.homeworkTypeIds.length) return [];

    var result = await window.db.from('schedules')
      .select('id,semester_id,schedule_date,item_ids,is_valid,org_id')
      .eq('semester_id', context.semesterId)
      .eq('is_valid', 1)
      .in('org_id', dabanIds)
      .order('schedule_date', { ascending: false });
    if (result.error) throw result.error;
    return (result.data || []).filter(function (schedule) {
      return scheduleHasHomework(schedule, context.homeworkTypeIds);
    });
  }

  async function loadGroupMembers(semesterId, groupIds) {
    if (!groupIds || !groupIds.length) return {};
    var assignmentResult = await window.db.from('person_org_assignments')
      .select('person_id,org_id,sort_order')
      .eq('semester_id', semesterId)
      .eq('org_level', '小组')
      .eq('status', 'active')
      .in('org_id', groupIds)
      .order('sort_order')
      .order('person_id');
    if (assignmentResult.error) throw assignmentResult.error;

    var assignments = assignmentResult.data || [];
    var personIds = Array.from(new Set(assignments.map(function (item) {
      return Number(item.person_id);
    }).filter(Boolean)));
    var people = [];
    if (personIds.length) {
      var peopleResult = await window.db.from('people')
        .select('id,name,status')
        .in('id', personIds)
        .eq('status', 'active')
        .order('name');
      if (peopleResult.error) throw peopleResult.error;
      people = peopleResult.data || [];
    }
    var peopleById = {};
    people.forEach(function (person) {
      peopleById[Number(person.id)] = person;
    });
    var map = {};
    assignments.forEach(function (assignment) {
      var person = peopleById[Number(assignment.person_id)];
      if (!person) return;
      var groupId = Number(assignment.org_id);
      if (!map[groupId]) map[groupId] = [];
      map[groupId].push(person);
    });
    return map;
  }

  async function loadEntries(scheduleId, groupIds) {
    if (!scheduleId || !groupIds || !groupIds.length) return [];
    var result = await window.db.from('excellent_homework_entries')
      .select('*')
      .eq('schedule_id', Number(scheduleId))
      .in('org_id', groupIds)
      .order('org_id')
      .order('slot_index');
    if (result.error) throw result.error;
    return result.data || [];
  }

  window.ExcellentHomework = {
    isPlatformAdmin: isPlatformAdmin,
    getOrg: getOrg,
    getDabanId: getDabanId,
    isOrgAncestor: isOrgAncestor,
    getGroupsForScope: getGroupsForScope,
    scheduleHasHomework: scheduleHasHomework,
    formatDate: formatDate,
    formatShortDate: formatShortDate,
    loadAccessContext: loadAccessContext,
    loadEligibleSchedules: loadEligibleSchedules,
    loadGroupMembers: loadGroupMembers,
    loadEntries: loadEntries
  };
})();
