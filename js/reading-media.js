// ============================================================
// 每日共读影像共享工具：权限范围、日程、岗位、原图与签名地址
// ============================================================

var ReadingMedia = (function () {
  var BUCKET = 'reading-media';
  var SCOPE_LABELS = { 大班: '大班共读', 班级: '班级共读', 小组: '小组共读' };
  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    var result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  function getScopeLabel(scope) {
    return SCOPE_LABELS[scope] || scope || '共读';
  }

  function getWeekday(dateString) {
    var date = new Date(String(dateString || '') + 'T00:00:00');
    return Number.isNaN(date.getTime()) ? '' : WEEKDAYS[date.getDay()];
  }

  function formatDisplayDate(dateString) {
    var date = new Date(String(dateString || '') + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return '';
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function buildOrgMap(orgs) {
    var map = {};
    (orgs || []).forEach(function (org) {
      map[Number(org.id)] = org;
    });
    return map;
  }

  function getOrgChain(orgId, orgMap) {
    var chain = [];
    var current = orgMap[Number(orgId)];
    while (current) {
      chain.unshift(current);
      current = current.parent_id ? orgMap[Number(current.parent_id)] : null;
    }
    return chain;
  }

  function getOrgPath(orgId, orgMap) {
    return getOrgChain(orgId, orgMap)
      .map(function (org) {
        return org.name;
      })
      .join(' · ');
  }

  function canAccessOrg(context, orgId) {
    if (!context) return false;
    if (context.isPlatformAdmin || context.hasGlobalAccess) return true;
    var chainIds = getOrgChain(orgId, context.orgMap).map(function (org) {
      return Number(org.id);
    });
    return context.membershipOrgIds.some(function (membershipOrgId) {
      return chainIds.indexOf(Number(membershipOrgId)) !== -1;
    });
  }

  function canAccessRelatedOrg(context, orgId) {
    if (canAccessOrg(context, orgId)) return true;
    if (!context || context.isPlatformAdmin || context.hasGlobalAccess) return true;
    return context.membershipOrgIds.some(function (membershipOrgId) {
      return getOrgChain(membershipOrgId, context.orgMap).some(function (org) {
        return Number(org.id) === Number(orgId);
      });
    });
  }

  async function loadContext(moduleKey) {
    var user = getCurrentUser();
    var semesterId = await getCurrentSemesterId();
    if (!user || !semesterId) throw new Error('未找到当前账号或当前学期');

    var orgResult = await window.db
      .from('organizations')
      .select('id,name,level,parent_id,sort_order')
      .eq('semester_id', semesterId)
      .eq('is_active', true)
      .order('sort_order');
    if (orgResult.error) throw orgResult.error;

    var isPlatformAdmin = user.role === '超级管理员' || user.role === '管理员';
    var memberships = [];
    if (!isPlatformAdmin) {
      var membershipResult = await window.db
        .from('module_memberships')
        .select('id,role,org_id')
        .eq('user_id', user.id)
        .eq('semester_id', semesterId)
        .eq('module_key', moduleKey)
        .eq('enabled', true);
      if (membershipResult.error) throw membershipResult.error;
      memberships = membershipResult.data || [];
    }

    var membershipOrgIds = memberships
      .map(function (membership) {
        return numberOrNull(membership.org_id);
      })
      .filter(Boolean);
    var hasGlobalAccess =
      isPlatformAdmin ||
      memberships.some(function (membership) {
        return !membership.org_id && ['管理员', 'admin', 'manager'].indexOf(membership.role) !== -1;
      });
    var orgs = orgResult.data || [];

    return {
      user: user,
      semesterId: Number(semesterId),
      moduleKey: moduleKey,
      isPlatformAdmin: isPlatformAdmin,
      hasGlobalAccess: hasGlobalAccess,
      memberships: memberships,
      membershipOrgIds: membershipOrgIds,
      orgs: orgs,
      orgMap: buildOrgMap(orgs)
    };
  }

  async function loadSchedules(context, dateString) {
    var result = await window.db
      .from('study_schedule_instances')
      .select('*')
      .eq('semester_id', context.semesterId)
      .eq('schedule_date', dateString)
      .order('scope_level')
      .order('org_id');
    if (result.error) throw result.error;
    return (result.data || []).filter(function (schedule) {
      return canAccessRelatedOrg(context, schedule.org_id);
    });
  }

  function findScheduleForSourceOrg(schedules, sourceOrg, orgMap) {
    if (!sourceOrg) return null;
    var classOrg = orgMap[Number(sourceOrg.parent_id)];
    var bigClass = classOrg ? orgMap[Number(classOrg.parent_id)] : null;
    var candidateOrgIds = [sourceOrg.id, classOrg && classOrg.id, bigClass && bigClass.id].filter(Boolean);
    var referenceSchedule = null;
    candidateOrgIds.some(function (orgId) {
      referenceSchedule =
        (schedules || []).find(function (schedule) {
          return Number(schedule.org_id) === Number(orgId);
        }) || null;
      return !!referenceSchedule;
    });
    if (!referenceSchedule) return null;

    var scheduleOrgId = sourceOrg.id;
    if (referenceSchedule.scope_level === '班级' && classOrg) {
      scheduleOrgId = classOrg.id;
    } else if (referenceSchedule.scope_level === '大班' && bigClass) {
      scheduleOrgId = bigClass.id;
    }
    return (
      (schedules || []).find(function (schedule) {
        return (
          Number(schedule.org_id) === Number(scheduleOrgId) &&
          schedule.scope_level === referenceSchedule.scope_level &&
          Number(schedule.reading_type_id) === Number(referenceSchedule.reading_type_id)
        );
      }) || null
    );
  }

  async function loadSignedUrls(assets) {
    var list = assets || [];
    if (!list.length) return list;
    var paths = list.map(function (asset) {
      return asset.storage_path;
    });
    var signedResult = await window.db.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
    if (signedResult.error) throw signedResult.error;
    var signedMap = {};
    (signedResult.data || []).forEach(function (item, index) {
      signedMap[item.path || paths[index]] = item.signedUrl || item.signedURL || '';
    });
    return list.map(function (asset) {
      return Object.assign({}, asset, { signed_url: signedMap[asset.storage_path] || '' });
    });
  }

  async function loadScheduleBundle(schedule, sourceOrgId) {
    var typePromise = schedule.reading_type_id
      ? window.db
          .from('study_reading_types')
          .select('id,type_name,scope_level')
          .eq('id', schedule.reading_type_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    var contentPromise = window.db
      .from('study_schedule_content')
      .select('*')
      .eq('schedule_instance_id', schedule.id)
      .eq('org_id', schedule.org_id)
      .maybeSingle();
    var demandsPromise = window.db
      .from('study_assignment_demands')
      .select('*')
      .eq('schedule_instance_id', schedule.id)
      .order('slot_index')
      .order('role_name');
    var assetsQuery = window.db
      .from('study_reading_media_assets')
      .select('*')
      .eq('schedule_instance_id', schedule.id)
      .eq('org_id', schedule.org_id)
      .order('sort_order')
      .order('id');
    if (sourceOrgId) assetsQuery = assetsQuery.eq('source_org_id', sourceOrgId);

    var results = await Promise.all([typePromise, contentPromise, demandsPromise, assetsQuery]);
    results.forEach(function (result) {
      if (result.error) throw result.error;
    });

    var demands = results[2].data || [];
    var demandIds = demands.map(function (demand) {
      return Number(demand.id);
    });
    var people = [];
    if (demandIds.length) {
      var peopleResult = await window.db
        .from('study_assignment_people')
        .select('*')
        .in('demand_id', demandIds)
        .order('id');
      if (peopleResult.error) throw peopleResult.error;
      people = peopleResult.data || [];
    }

    var peopleByDemand = {};
    people.forEach(function (person) {
      var key = Number(person.demand_id);
      if (!peopleByDemand[key]) peopleByDemand[key] = [];
      peopleByDemand[key].push(person);
    });

    var assignments = [];
    demands.forEach(function (demand) {
      (peopleByDemand[Number(demand.id)] || []).forEach(function (person) {
        assignments.push({
          demand_id: Number(demand.id),
          assignment_person_id: Number(person.id),
          role_name: demand.role_name || '岗位',
          person_name: person.person_name_snapshot || '未命名人员',
          org_id: person.org_id || demand.target_org_id || schedule.org_id,
          slot_index: demand.slot_index || 0
        });
      });
    });
    if (sourceOrgId) {
      assignments = assignments.filter(function (assignment) {
        return Number(assignment.org_id) === Number(sourceOrgId);
      });
    }

    return {
      schedule: schedule,
      readingType: results[0].data || null,
      content: results[1].data || null,
      demands: demands,
      people: people,
      assignments: assignments,
      assets: await loadSignedUrls(results[3].data || [])
    };
  }

  function safeExtension(file) {
    var original = String((file && file.name) || '');
    var match = original.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (match) return match[1].toLowerCase();
    var mime = String((file && file.type) || '');
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  function uniqueFileName(file) {
    var random =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now() + '-' + Math.random().toString(16).slice(2);
    return random + '.' + safeExtension(file);
  }

  function getImageDimensions(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null });
        URL.revokeObjectURL(url);
      };
      image.onerror = function () {
        resolve({ width: null, height: null });
        URL.revokeObjectURL(url);
      };
      image.src = url;
    });
  }

  async function uploadAsset(context, schedule, file, target, caption, sortOrder) {
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!file || allowedTypes.indexOf(String(file.type || '').toLowerCase()) === -1) {
      throw new Error('仅支持 JPG、PNG 或 WebP 图片');
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new Error('单张图片不能超过 15MB');
    }

    var objectName = uniqueFileName(file);
    var sourceOrgId = Number(target.source_org_id || target.org_id || schedule.org_id);
    var storagePath = context.semesterId + '/' + sourceOrgId + '/' + schedule.id + '/' + objectName;
    var dimensions = await getImageDimensions(file);
    var uploadResult = await window.db.storage.from(BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    });
    if (uploadResult.error) throw uploadResult.error;

    var payload = {
      semester_id: context.semesterId,
      schedule_instance_id: Number(schedule.id),
      org_id: Number(schedule.org_id),
      source_org_id: sourceOrgId,
      asset_kind: target.kind || 'other',
      demand_id: target.demand_id || null,
      assignment_person_id: target.assignment_person_id || null,
      role_name_snapshot: target.role_name || '',
      person_name_snapshot: target.person_name || '',
      caption: caption || '',
      storage_path: storagePath,
      file_name: file.name || objectName,
      mime_type: file.type || 'image/jpeg',
      file_size: file.size || 0,
      image_width: dimensions.width,
      image_height: dimensions.height,
      sort_order: sortOrder || 0,
      submitted_by: context.user.id
    };
    var insertResult = await window.db.from('study_reading_media_assets').insert(payload).select('*').single();
    if (insertResult.error) {
      await window.db.storage.from(BUCKET).remove([storagePath]);
      throw insertResult.error;
    }
    return insertResult.data;
  }

  async function deleteAsset(asset) {
    var deleteResult = await window.db.from('study_reading_media_assets').delete().eq('id', asset.id);
    if (deleteResult.error) throw deleteResult.error;
    var storageResult = await window.db.storage.from(BUCKET).remove([asset.storage_path]);
    if (storageResult.error) throw storageResult.error;
  }

  function getDefaultTitle(schedule, org, readingType) {
    return (org ? org.name : '今日') + '晨读';
  }

  function getDefaultSubtitle(schedule, readingType) {
    return (readingType && readingType.type_name) || getScopeLabel(schedule && schedule.scope_level);
  }

  return {
    BUCKET: BUCKET,
    numberOrNull: numberOrNull,
    getScopeLabel: getScopeLabel,
    getWeekday: getWeekday,
    formatDisplayDate: formatDisplayDate,
    buildOrgMap: buildOrgMap,
    getOrgChain: getOrgChain,
    getOrgPath: getOrgPath,
    canAccessOrg: canAccessOrg,
    canAccessRelatedOrg: canAccessRelatedOrg,
    loadContext: loadContext,
    loadSchedules: loadSchedules,
    findScheduleForSourceOrg: findScheduleForSourceOrg,
    loadSignedUrls: loadSignedUrls,
    loadScheduleBundle: loadScheduleBundle,
    uploadAsset: uploadAsset,
    deleteAsset: deleteAsset,
    getDefaultTitle: getDefaultTitle,
    getDefaultSubtitle: getDefaultSubtitle
  };
})();
