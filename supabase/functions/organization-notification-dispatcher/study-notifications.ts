type SupabaseClientLike = {
  from: (table: string) => any;
};

export type BeijingNow = {
  date: string;
  time: string;
  dayOfWeek: number;
  minuteOfDay: number;
};

type Organization = {
  id: number;
  name: string;
  level: string;
  parent_id: number | null;
  sort_order?: number | null;
};

type StudyNoticeSettings = {
  daily_send_time: string;
  daily_lead_days: number;
  weekly_course_weekday: number;
  weekly_course_send_time: string;
  weekly_assignment_weekday: number;
  weekly_assignment_send_time: string;
  default_start_time: string;
  default_end_time: string;
  bigclass_end_time: string;
  teaching_covenant_title: string;
  teaching_covenant_url: string;
  group_meeting_info: string;
  class_meeting_info: string;
  bigclass_meeting_info: string;
  footer: string;
};

type ClassStudyConfig = {
  org_id: number;
  study_daily_enabled: boolean;
  study_weekly_course_enabled: boolean;
  study_weekly_assignment_enabled: boolean;
  study_notice_settings: Record<string, unknown> | null;
};

type ScheduleInstance = {
  id: number;
  schedule_date: string;
  scope_level: string;
  org_id: number;
  course_id: number | null;
  custom_title: string | null;
  custom_theme: string | null;
  custom_content: string | null;
  custom_question: string | null;
  custom_paper_pages: string | null;
  custom_ebook_url: string | null;
  note: string | null;
  reading_type_id: number | null;
};

type ScheduleContent = {
  id: number;
  schedule_instance_id: number;
  org_id: number;
  course_id: number | null;
  custom_title: string | null;
  custom_theme: string | null;
  custom_content: string | null;
  custom_question: string | null;
  custom_paper_pages: string | null;
  custom_ebook_url: string | null;
  note: string | null;
  sort_order: number | null;
};

type SemesterCourseRow = {
  id: number;
  schedule_date: string;
  course_id: number | null;
  custom_title: string | null;
  custom_theme: string | null;
  custom_content: string | null;
  custom_question: string | null;
  custom_paper_pages: string | null;
  custom_ebook_url: string | null;
  note: string | null;
  sort_order: number | null;
};

type Course = {
  id: number;
  chapter_title: string | null;
  theme: string | null;
  title: string | null;
  study_content: string | null;
  thinking_questions: string | null;
  paper_pages: string | null;
  ebook_url: string | null;
};

type Demand = {
  id: number;
  schedule_instance_id: number;
  from_org_id: number;
  target_org_id: number | null;
  role_name: string;
  required_count: number;
  parent_demand_id: number | null;
  slot_index: number | null;
};

type AssignmentPerson = {
  id: number;
  demand_id: number;
  person_name_snapshot: string | null;
  org_id: number | null;
};

type CourseItem = {
  title: string;
  theme: string;
  content: string;
  paperPages: string;
  ebookUrl: string;
  note: string;
};

type AssignmentEntry = {
  roleName: string;
  slotIndex: number;
  personName: string;
  orgId: number | null;
  pending: boolean;
};

type StudyData = {
  semesterId: number;
  semesterName: string;
  organizations: Organization[];
  orgMap: Map<number, Organization>;
  schedules: ScheduleInstance[];
  scheduleMap: Map<string, ScheduleInstance>;
  contentsBySchedule: Map<number, ScheduleContent[]>;
  semesterCoursesByDate: Map<string, SemesterCourseRow[]>;
  courseMap: Map<number, Course>;
  demands: Demand[];
  demandsBySchedule: Map<number, Demand[]>;
  childDemands: Map<number, Demand[]>;
  peopleByDemand: Map<number, AssignmentPerson[]>;
};

type NotificationCandidate = {
  orgId: number;
  eventKey: string;
  title: string;
  content: string;
  dedupeKey: string;
};

type StudyTask = {
  kind: 'daily' | 'weekly_course' | 'weekly_assignment';
  config: ClassStudyConfig;
  settings: StudyNoticeSettings;
  targetDate?: string;
  weekMonday?: string;
  weekSunday?: string;
};

const DEFAULT_SETTINGS: StudyNoticeSettings = {
  daily_send_time: '20:00',
  daily_lead_days: 1,
  weekly_course_weekday: 7,
  weekly_course_send_time: '20:00',
  weekly_assignment_weekday: 4,
  weekly_assignment_send_time: '20:00',
  default_start_time: '06:00',
  default_end_time: '07:00',
  bigclass_end_time: '07:30',
  teaching_covenant_title: '传习课堂教约',
  teaching_covenant_url: 'https://mp.weixin.qq.com/s/yOoMV5TEOacQMBVK8JDwVQ',
  group_meeting_info: '',
  class_meeting_info: '',
  bigclass_meeting_info: '',
  footer: '分享人员请提前准备；请提前5至10分钟进入会议室，穿班服、统一背景、全程开启摄像头。'
};

const WEEKDAY_NAMES = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
const SHORT_WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const ROLE_ORDER = [
  '主持人',
  '主持',
  '领读',
  '备读',
  '聆听',
  '分享人',
  '分享',
  '回应砥砺',
  '回应',
  '总结赋能',
  '感恩总结',
  '播控',
  '控麦',
  '拍照',
  '计时',
  '时间郎',
  '海报'
];

function cleanText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeTime(value: unknown, fallback: string): string {
  const normalized = cleanText(value).slice(0, 5);
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(normalized) ? normalized : fallback;
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function resolveSettings(raw: Record<string, unknown> | null): StudyNoticeSettings {
  const value = raw || {};
  return {
    daily_send_time: normalizeTime(value.daily_send_time, DEFAULT_SETTINGS.daily_send_time),
    daily_lead_days: clampInteger(value.daily_lead_days, DEFAULT_SETTINGS.daily_lead_days, 0, 7),
    weekly_course_weekday: clampInteger(value.weekly_course_weekday, DEFAULT_SETTINGS.weekly_course_weekday, 1, 7),
    weekly_course_send_time: normalizeTime(value.weekly_course_send_time, DEFAULT_SETTINGS.weekly_course_send_time),
    weekly_assignment_weekday: clampInteger(
      value.weekly_assignment_weekday,
      DEFAULT_SETTINGS.weekly_assignment_weekday,
      1,
      7
    ),
    weekly_assignment_send_time: normalizeTime(
      value.weekly_assignment_send_time,
      DEFAULT_SETTINGS.weekly_assignment_send_time
    ),
    default_start_time: normalizeTime(value.default_start_time, DEFAULT_SETTINGS.default_start_time),
    default_end_time: normalizeTime(value.default_end_time, DEFAULT_SETTINGS.default_end_time),
    bigclass_end_time: normalizeTime(value.bigclass_end_time, DEFAULT_SETTINGS.bigclass_end_time),
    teaching_covenant_title: cleanText(value.teaching_covenant_title) || DEFAULT_SETTINGS.teaching_covenant_title,
    teaching_covenant_url: cleanText(value.teaching_covenant_url) || DEFAULT_SETTINGS.teaching_covenant_url,
    group_meeting_info: cleanText(value.group_meeting_info),
    class_meeting_info: cleanText(value.class_meeting_info),
    bigclass_meeting_info: cleanText(value.bigclass_meeting_info),
    footer: cleanText(value.footer) || DEFAULT_SETTINGS.footer
  };
}

function timeToMinutes(value: string): number {
  const parts = value.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(dateValue + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekday(dateValue: string): number {
  const weekday = new Date(dateValue + 'T00:00:00Z').getUTCDay();
  return weekday || 7;
}

function nextMonday(dateValue: string): string {
  return addDays(dateValue, 8 - getWeekday(dateValue));
}

function formatDate(dateValue: string): string {
  const parts = dateValue.split('-');
  return Number(parts[0]) + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
}

function scheduleKey(dateValue: string, scopeLevel: string, orgId: number): string {
  return dateValue + '|' + scopeLevel + '|' + orgId;
}

function hasContentValue(row: {
  course_id?: number | null;
  custom_title?: string | null;
  custom_theme?: string | null;
  custom_content?: string | null;
  custom_question?: string | null;
  custom_paper_pages?: string | null;
  custom_ebook_url?: string | null;
}): boolean {
  return Boolean(
    row.course_id ||
    cleanText(row.custom_title) ||
    cleanText(row.custom_theme) ||
    cleanText(row.custom_content) ||
    cleanText(row.custom_question) ||
    cleanText(row.custom_paper_pages) ||
    cleanText(row.custom_ebook_url)
  );
}

function materializeCourse(
  row: {
    course_id?: number | null;
    custom_title?: string | null;
    custom_theme?: string | null;
    custom_content?: string | null;
    custom_paper_pages?: string | null;
    custom_ebook_url?: string | null;
    note?: string | null;
  },
  courseMap: Map<number, Course>
): CourseItem {
  const course = row.course_id ? courseMap.get(Number(row.course_id)) : null;
  return {
    title:
      cleanText(row.custom_content) ||
      cleanText(course?.chapter_title) ||
      cleanText(row.custom_title) ||
      cleanText(course?.title) ||
      '课程内容待补充',
    theme: cleanText(row.custom_theme) || cleanText(course?.theme),
    content: cleanText(row.custom_content) || cleanText(course?.study_content),
    paperPages: cleanText(row.custom_paper_pages) || cleanText(course?.paper_pages),
    ebookUrl: cleanText(row.custom_ebook_url) || cleanText(course?.ebook_url),
    note: cleanText(row.note)
  };
}

function getAncestors(orgId: number, orgMap: Map<number, Organization>): Organization[] {
  const result: Organization[] = [];
  let current = orgMap.get(Number(orgId)) || null;
  while (current) {
    result.unshift(current);
    current = current.parent_id ? orgMap.get(Number(current.parent_id)) || null : null;
  }
  return result;
}

function getAncestorAtLevel(
  orgId: number | null,
  level: string,
  orgMap: Map<number, Organization>
): Organization | null {
  if (!orgId) return null;
  return getAncestors(orgId, orgMap).find((organization) => organization.level === level) || null;
}

function getDescendants(parentId: number, organizations: Organization[]): Organization[] {
  const result: Organization[] = [];
  const queue = [Number(parentId)];
  while (queue.length) {
    const currentId = queue.shift()!;
    const children = organizations.filter((organization) => Number(organization.parent_id) === currentId);
    for (const child of children) {
      result.push(child);
      queue.push(Number(child.id));
    }
  }
  return result;
}

function sortOrganizations(organizations: Organization[]): Organization[] {
  return organizations.slice().sort((left, right) => {
    const orderDifference = Number(left.sort_order || 0) - Number(right.sort_order || 0);
    if (orderDifference) return orderDifference;
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function resolveCourseItems(schedule: ScheduleInstance, data: StudyData): CourseItem[] {
  const ancestorIds = getAncestors(schedule.org_id, data.orgMap).map((organization) => Number(organization.id));
  let allowedIds = ancestorIds;
  if (schedule.scope_level === '大班') {
    allowedIds = ancestorIds.filter((orgId) => data.orgMap.get(orgId)?.level === '大班');
  } else if (schedule.scope_level === '班级') {
    allowedIds = ancestorIds.filter((orgId) => {
      const level = data.orgMap.get(orgId)?.level;
      return level === '大班' || level === '班级';
    });
  }

  for (const orgId of allowedIds.slice().reverse()) {
    const candidate = data.scheduleMap.get(scheduleKey(schedule.schedule_date, schedule.scope_level, orgId));
    if (!candidate) continue;
    const contentRows = (data.contentsBySchedule.get(Number(candidate.id)) || [])
      .filter(hasContentValue)
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
    if (contentRows.length) {
      return contentRows.map((row) => materializeCourse(row, data.courseMap));
    }
    if (hasContentValue(candidate)) {
      return [materializeCourse(candidate, data.courseMap)];
    }
  }

  return (data.semesterCoursesByDate.get(schedule.schedule_date) || [])
    .filter(hasContentValue)
    .map((row) => materializeCourse(row, data.courseMap));
}

function formatCourseItems(items: CourseItem[], settings: StudyNoticeSettings): string {
  const lines = ['1. ' + settings.teaching_covenant_title, settings.teaching_covenant_url];
  items.forEach((item, index) => {
    let label = item.title;
    if (item.paperPages) label += '  ' + item.paperPages;
    lines.push(String(index + 2) + '. ' + label);
    if (item.ebookUrl) lines.push(item.ebookUrl);
  });
  return lines.join('\n');
}

function collectAssignments(scheduleId: number, data: StudyData): AssignmentEntry[] {
  const starts = data.demandsBySchedule.get(Number(scheduleId)) || [];
  const queue = starts.slice();
  const visited = new Set<number>();
  const demands: Demand[] = [];
  while (queue.length) {
    const demand = queue.shift()!;
    if (visited.has(Number(demand.id))) continue;
    visited.add(Number(demand.id));
    demands.push(demand);
    queue.push(...(data.childDemands.get(Number(demand.id)) || []));
  }

  const entries: AssignmentEntry[] = [];
  for (const demand of demands) {
    const children = data.childDemands.get(Number(demand.id)) || [];
    const people = data.peopleByDemand.get(Number(demand.id)) || [];
    people.forEach((person) => {
      entries.push({
        roleName: cleanText(demand.role_name) || '岗位',
        slotIndex: Number(demand.slot_index || 0),
        personName: cleanText(person.person_name_snapshot) || '待确认',
        orgId: person.org_id ? Number(person.org_id) : demand.target_org_id ? Number(demand.target_org_id) : null,
        pending: false
      });
    });
    if (!children.length && people.length < Number(demand.required_count || 0)) {
      const missing = Number(demand.required_count || 0) - people.length;
      for (let index = 0; index < missing; index++) {
        entries.push({
          roleName: cleanText(demand.role_name) || '岗位',
          slotIndex: Number(demand.slot_index || 0) + index,
          personName: '待安排',
          orgId: demand.target_org_id ? Number(demand.target_org_id) : Number(demand.from_org_id),
          pending: true
        });
      }
    }
  }

  const dedupe = new Map<string, AssignmentEntry>();
  entries.forEach((entry) => {
    const key = [entry.roleName, entry.slotIndex, entry.personName, entry.orgId || 0].join('|');
    if (!dedupe.has(key)) dedupe.set(key, entry);
  });
  return Array.from(dedupe.values());
}

function roleOrder(roleName: string): number {
  const exact = ROLE_ORDER.indexOf(roleName);
  if (exact >= 0) return exact;
  const partial = ROLE_ORDER.findIndex((role) => roleName.includes(role) || role.includes(roleName));
  return partial >= 0 ? partial : ROLE_ORDER.length + 1;
}

function filterAssignmentsForClass(entries: AssignmentEntry[], classId: number, data: StudyData): AssignmentEntry[] {
  return entries.filter((entry) => {
    if (!entry.orgId) return false;
    const classOrganization = getAncestorAtLevel(entry.orgId, '班级', data.orgMap);
    return Number(classOrganization?.id || 0) === Number(classId);
  });
}

function formatAssignments(entries: AssignmentEntry[], scopeLevel: string, data: StudyData): string {
  if (!entries.length) return '岗位安排：暂未录入';
  const roleMap = new Map<string, AssignmentEntry[]>();
  entries.forEach((entry) => {
    const rows = roleMap.get(entry.roleName) || [];
    rows.push(entry);
    roleMap.set(entry.roleName, rows);
  });
  const roles = Array.from(roleMap.keys()).sort((left, right) => {
    const orderDifference = roleOrder(left) - roleOrder(right);
    if (orderDifference) return orderDifference;
    return left.localeCompare(right, 'zh-CN');
  });
  const lines: string[] = [];
  roles.forEach((roleName) => {
    const roleEntries = (roleMap.get(roleName) || []).sort((left, right) => left.slotIndex - right.slotIndex);
    if (scopeLevel === '小组') {
      lines.push('**' + roleName + '**：' + roleEntries.map((entry) => entry.personName).join('、'));
      return;
    }
    const grouped = new Map<string, AssignmentEntry[]>();
    roleEntries.forEach((entry) => {
      let groupOrganization: Organization | null = null;
      if (scopeLevel === '大班') {
        groupOrganization = getAncestorAtLevel(entry.orgId, '班级', data.orgMap);
      } else if (scopeLevel === '班级') {
        groupOrganization = getAncestorAtLevel(entry.orgId, '小组', data.orgMap);
      }
      const label = groupOrganization?.name || '本级';
      const rows = grouped.get(label) || [];
      rows.push(entry);
      grouped.set(label, rows);
    });
    if (grouped.size === 1 && grouped.has('本级')) {
      lines.push('**' + roleName + '**：' + roleEntries.map((entry) => entry.personName).join('、'));
      return;
    }
    lines.push('**' + roleName + '**');
    grouped.forEach((rows, label) => {
      lines.push('- ' + label + '：' + rows.map((entry) => entry.personName).join('、'));
    });
  });
  return lines.join('\n');
}

function getMeetingInfo(scopeLevel: string, settings: StudyNoticeSettings, courseItems: CourseItem[]): string {
  const contentNote = courseItems.map((item) => item.note).find(Boolean);
  if (contentNote) return contentNote;
  if (scopeLevel === '大班') return settings.bigclass_meeting_info;
  if (scopeLevel === '班级') return settings.class_meeting_info;
  return settings.group_meeting_info;
}

function buildDailyCandidate(
  classOrg: Organization,
  bigClassOrg: Organization,
  schedule: ScheduleInstance,
  settings: StudyNoticeSettings,
  data: StudyData,
  classFilterId?: number
): NotificationCandidate | null {
  const courseItems = resolveCourseItems(schedule, data);
  if (!courseItems.length) return null;
  let assignments = collectAssignments(schedule.id, data);
  if (classFilterId) assignments = filterAssignmentsForClass(assignments, classFilterId, data);
  const sourceOrg = data.orgMap.get(Number(schedule.org_id)) || classOrg;
  const semesterNumber = (data.semesterName.match(/(\d+)\s*期/) || [])[1] || '';
  let title = '晨读通知';
  if (schedule.scope_level === '大班') {
    title = '【' + bigClassOrg.name + ' · 联合共读】';
  } else if (schedule.scope_level === '班级') {
    title = '【' + classOrg.name + ' · 班级共读】';
  } else {
    title = '【' + (semesterNumber ? semesterNumber + '期 · ' : '') + sourceOrg.name + ' · 晨读】';
  }
  const endTime = schedule.scope_level === '大班' ? settings.bigclass_end_time : settings.default_end_time;
  const meetingInfo = getMeetingInfo(schedule.scope_level, settings, courseItems);
  const content = [
    '📅 日期：' + formatDate(schedule.schedule_date) + ' ' + WEEKDAY_NAMES[getWeekday(schedule.schedule_date)],
    '⏰ 时间：' + settings.default_start_time + '—' + endTime,
    '',
    '📖 **共读内容**',
    formatCourseItems(courseItems, settings),
    '',
    '📋 **岗位安排**',
    formatAssignments(assignments, schedule.scope_level, data),
    meetingInfo ? '\n📍 **会议地点**\n' + meetingInfo : '',
    settings.footer ? '\n📌 **温馨提示**\n' + settings.footer : ''
  ]
    .filter(Boolean)
    .join('\n');
  return {
    orgId: Number(classOrg.id),
    eventKey: 'study_daily_notice',
    title,
    content,
    dedupeKey: 'study-daily:' + schedule.schedule_date + ':' + schedule.scope_level + ':' + schedule.org_id + ':v1'
  };
}

function buildDailyCandidates(task: StudyTask, data: StudyData): NotificationCandidate[] {
  const classOrg = data.orgMap.get(Number(task.config.org_id));
  if (!classOrg || classOrg.level !== '班级' || !task.targetDate) return [];
  const bigClassOrg = getAncestorAtLevel(classOrg.id, '大班', data.orgMap);
  if (!bigClassOrg) return [];
  const classSchedule = data.schedules.find(
    (schedule) => schedule.schedule_date === task.targetDate && Number(schedule.org_id) === Number(classOrg.id)
  );
  if (!classSchedule) return [];
  if (classSchedule.scope_level === '小组') {
    const groups = sortOrganizations(
      data.organizations.filter(
        (organization) => organization.level === '小组' && Number(organization.parent_id) === Number(classOrg.id)
      )
    );
    return groups
      .map((group) => {
        const groupSchedule = data.scheduleMap.get(scheduleKey(task.targetDate!, '小组', Number(group.id)));
        return groupSchedule ? buildDailyCandidate(classOrg, bigClassOrg, groupSchedule, task.settings, data) : null;
      })
      .filter((candidate): candidate is NotificationCandidate => Boolean(candidate));
  }
  const canonicalOrgId = classSchedule.scope_level === '大班' ? Number(bigClassOrg.id) : Number(classOrg.id);
  const canonicalSchedule =
    data.scheduleMap.get(scheduleKey(task.targetDate, classSchedule.scope_level, canonicalOrgId)) || classSchedule;
  return [buildDailyCandidate(classOrg, bigClassOrg, canonicalSchedule, task.settings, data)].filter(
    (candidate): candidate is NotificationCandidate => Boolean(candidate)
  );
}

function buildWeeklyCourseCandidate(task: StudyTask, data: StudyData): NotificationCandidate | null {
  const classOrg = data.orgMap.get(Number(task.config.org_id));
  if (!classOrg || !task.weekMonday || !task.weekSunday) return null;
  const sections: string[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const dateValue = addDays(task.weekMonday, offset);
    const rows = data.semesterCoursesByDate.get(dateValue) || [];
    const items = rows.filter(hasContentValue).map((row) => materializeCourse(row, data.courseMap));
    if (!items.length) continue;
    const theme = items.map((item) => item.theme).find(Boolean);
    sections.push(
      [
        '**' + dateValue.replace(/-/g, '/') + ' ' + WEEKDAY_NAMES[getWeekday(dateValue)] + '**',
        theme ? '主题：《' + theme + '》' : '',
        '读书内容：',
        formatCourseItems(items, task.settings)
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
  if (!sections.length) return null;
  return {
    orgId: Number(classOrg.id),
    eventKey: 'study_weekly_course',
    title: '下周课程安排',
    content: ['@所有人', '', '下周读书内容请各位学委查收，提前铺排晨读：', '', sections.join('\n\n')].join('\n'),
    dedupeKey: 'study-weekly-course:' + task.weekMonday + ':v1'
  };
}

function buildWeeklyAssignmentCandidate(task: StudyTask, data: StudyData): NotificationCandidate | null {
  const classOrg = data.orgMap.get(Number(task.config.org_id));
  if (!classOrg || !task.weekMonday || !task.weekSunday) return null;
  const bigClassOrg = getAncestorAtLevel(classOrg.id, '大班', data.orgMap);
  if (!bigClassOrg) return null;
  const sections: string[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const dateValue = addDays(task.weekMonday, offset);
    const classSchedule = data.schedules.find(
      (schedule) => schedule.schedule_date === dateValue && Number(schedule.org_id) === Number(classOrg.id)
    );
    if (!classSchedule) continue;
    const heading =
      '🔷 ' +
      SHORT_WEEKDAY_NAMES[getWeekday(dateValue)] +
      ' · ' +
      (classSchedule.scope_level === '大班'
        ? '大班共读'
        : classSchedule.scope_level === '班级'
          ? '班级共读'
          : '小组共读');
    const detailLines: string[] = [heading];
    if (classSchedule.scope_level === '小组') {
      const groups = sortOrganizations(
        data.organizations.filter(
          (organization) => organization.level === '小组' && Number(organization.parent_id) === Number(classOrg.id)
        )
      );
      groups.forEach((group) => {
        const groupSchedule = data.scheduleMap.get(scheduleKey(dateValue, '小组', Number(group.id)));
        if (!groupSchedule) return;
        detailLines.push(
          '',
          '**' + group.name + '**',
          formatAssignments(collectAssignments(groupSchedule.id, data), '小组', data)
        );
      });
    } else {
      const canonicalOrgId = classSchedule.scope_level === '大班' ? Number(bigClassOrg.id) : Number(classOrg.id);
      const canonicalSchedule =
        data.scheduleMap.get(scheduleKey(dateValue, classSchedule.scope_level, canonicalOrgId)) || classSchedule;
      let assignments = collectAssignments(canonicalSchedule.id, data);
      if (classSchedule.scope_level === '大班') {
        assignments = filterAssignmentsForClass(assignments, Number(classOrg.id), data);
      }
      detailLines.push(formatAssignments(assignments, classSchedule.scope_level, data));
    }
    sections.push(detailLines.join('\n'));
  }
  if (!sections.length) return null;
  return {
    orgId: Number(classOrg.id),
    eventKey: 'study_weekly_assignment',
    title: '下周晨读安排 · ' + classOrg.name,
    content: [
      '请各位家人确认下周名单，如有调整请及时协调。',
      '',
      sections.join('\n\n──────────────\n\n'),
      '',
      '以上是下周晨读安排，请各位学长查收。确认无误请回复：收到'
    ].join('\n'),
    dedupeKey: 'study-weekly-assignment:' + task.weekMonday + ':v1'
  };
}

function splitContent(content: string, maximumLength = 3500): string[] {
  if (content.length <= maximumLength) return [content];
  const paragraphs = content.split('\n\n');
  const chunks: string[] = [];
  let current = '';
  paragraphs.forEach((paragraph) => {
    if (!current) {
      current = paragraph;
      return;
    }
    if ((current + '\n\n' + paragraph).length <= maximumLength) {
      current += '\n\n' + paragraph;
      return;
    }
    chunks.push(current);
    current = paragraph;
  });
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => {
    if (chunk.length <= maximumLength) return [chunk];
    const pieces: string[] = [];
    for (let index = 0; index < chunk.length; index += maximumLength) {
      pieces.push(chunk.slice(index, index + maximumLength));
    }
    return pieces;
  });
}

function expandCandidate(candidate: NotificationCandidate): NotificationCandidate[] {
  const chunks = splitContent(candidate.content);
  if (chunks.length === 1) return [candidate];
  return chunks.map((content, index) => ({
    ...candidate,
    title: candidate.title + '（' + (index + 1) + '/' + chunks.length + '）',
    content,
    dedupeKey: candidate.dedupeKey + ':part-' + (index + 1)
  }));
}

async function loadRowsInChunks(
  client: SupabaseClientLike,
  table: string,
  select: string,
  column: string,
  values: number[]
): Promise<any[]> {
  const rows: any[] = [];
  for (let index = 0; index < values.length; index += 100) {
    const chunk = values.slice(index, index + 100);
    const result = await client.from(table).select(select).in(column, chunk);
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
  }
  return rows;
}

async function loadStudyData(
  client: SupabaseClientLike,
  semesterId: number,
  semesterName: string,
  configs: ClassStudyConfig[],
  startDate: string,
  endDate: string
): Promise<StudyData> {
  const organizationResult = await client
    .from('organizations')
    .select('id,name,level,parent_id,sort_order')
    .eq('semester_id', semesterId)
    .eq('is_active', true);
  if (organizationResult.error) throw organizationResult.error;
  const organizations = (organizationResult.data || []) as Organization[];
  const orgMap = new Map(organizations.map((organization) => [Number(organization.id), organization]));
  const bigClassIds = Array.from(
    new Set(
      configs
        .map((config) => getAncestorAtLevel(Number(config.org_id), '大班', orgMap)?.id)
        .filter(Boolean)
        .map(Number)
    )
  );
  const relevantOrgIds = Array.from(
    new Set(
      bigClassIds.flatMap((bigClassId) => [
        Number(bigClassId),
        ...getDescendants(Number(bigClassId), organizations).map((organization) => Number(organization.id))
      ])
    )
  );

  const scheduleResult = await client
    .from('study_schedule_instances')
    .select(
      'id,schedule_date,scope_level,org_id,course_id,custom_title,custom_theme,custom_content,custom_question,custom_paper_pages,custom_ebook_url,note,reading_type_id'
    )
    .eq('semester_id', semesterId)
    .gte('schedule_date', startDate)
    .lte('schedule_date', endDate)
    .in('org_id', relevantOrgIds);
  if (scheduleResult.error) throw scheduleResult.error;
  const schedules = (scheduleResult.data || []) as ScheduleInstance[];
  const scheduleIds = schedules.map((schedule) => Number(schedule.id));

  const [contentRows, demandRows, semesterCourseResult] = await Promise.all([
    scheduleIds.length
      ? loadRowsInChunks(
          client,
          'study_schedule_content',
          'id,schedule_instance_id,org_id,course_id,custom_title,custom_theme,custom_content,custom_question,custom_paper_pages,custom_ebook_url,note,sort_order',
          'schedule_instance_id',
          scheduleIds
        )
      : Promise.resolve([]),
    scheduleIds.length
      ? loadRowsInChunks(
          client,
          'study_assignment_demands',
          'id,schedule_instance_id,from_org_id,target_org_id,role_name,required_count,parent_demand_id,slot_index',
          'schedule_instance_id',
          scheduleIds
        )
      : Promise.resolve([]),
    client
      .from('study_semester_course_schedule')
      .select(
        'id,schedule_date,course_id,custom_title,custom_theme,custom_content,custom_question,custom_paper_pages,custom_ebook_url,note,sort_order'
      )
      .eq('semester_id', semesterId)
      .gte('schedule_date', startDate)
      .lte('schedule_date', endDate)
  ]);
  if (semesterCourseResult.error) throw semesterCourseResult.error;

  const demands = demandRows as Demand[];
  const demandIds = demands.map((demand) => Number(demand.id));
  const peopleRows = demandIds.length
    ? await loadRowsInChunks(
        client,
        'study_assignment_people',
        'id,demand_id,person_name_snapshot,org_id',
        'demand_id',
        demandIds
      )
    : [];
  const allCourseIds = Array.from(
    new Set(
      [
        ...schedules.map((row) => row.course_id),
        ...(contentRows as ScheduleContent[]).map((row) => row.course_id),
        ...((semesterCourseResult.data || []) as SemesterCourseRow[]).map((row) => row.course_id)
      ]
        .filter(Boolean)
        .map(Number)
    )
  );
  const courseRows = allCourseIds.length
    ? await loadRowsInChunks(
        client,
        'study_course_library',
        'id,chapter_title,theme,title,study_content,thinking_questions,paper_pages,ebook_url',
        'id',
        allCourseIds
      )
    : [];

  const scheduleMap = new Map<string, ScheduleInstance>();
  schedules.forEach((schedule) => {
    scheduleMap.set(scheduleKey(schedule.schedule_date, schedule.scope_level, Number(schedule.org_id)), schedule);
  });
  const contentsBySchedule = new Map<number, ScheduleContent[]>();
  (contentRows as ScheduleContent[]).forEach((row) => {
    const rows = contentsBySchedule.get(Number(row.schedule_instance_id)) || [];
    rows.push(row);
    contentsBySchedule.set(Number(row.schedule_instance_id), rows);
  });
  const semesterCoursesByDate = new Map<string, SemesterCourseRow[]>();
  ((semesterCourseResult.data || []) as SemesterCourseRow[]).forEach((row) => {
    const rows = semesterCoursesByDate.get(row.schedule_date) || [];
    rows.push(row);
    rows.sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
    semesterCoursesByDate.set(row.schedule_date, rows);
  });
  const demandsBySchedule = new Map<number, Demand[]>();
  const childDemands = new Map<number, Demand[]>();
  demands.forEach((demand) => {
    const rows = demandsBySchedule.get(Number(demand.schedule_instance_id)) || [];
    rows.push(demand);
    demandsBySchedule.set(Number(demand.schedule_instance_id), rows);
    if (demand.parent_demand_id) {
      const children = childDemands.get(Number(demand.parent_demand_id)) || [];
      children.push(demand);
      childDemands.set(Number(demand.parent_demand_id), children);
    }
  });
  const peopleByDemand = new Map<number, AssignmentPerson[]>();
  (peopleRows as AssignmentPerson[]).forEach((person) => {
    const rows = peopleByDemand.get(Number(person.demand_id)) || [];
    rows.push(person);
    peopleByDemand.set(Number(person.demand_id), rows);
  });

  return {
    semesterId,
    semesterName,
    organizations,
    orgMap,
    schedules,
    scheduleMap,
    contentsBySchedule,
    semesterCoursesByDate,
    courseMap: new Map((courseRows as Course[]).map((course) => [Number(course.id), course])),
    demands,
    demandsBySchedule,
    childDemands,
    peopleByDemand
  };
}

function buildTasks(configs: ClassStudyConfig[], now: BeijingNow): StudyTask[] {
  const tasks: StudyTask[] = [];
  configs.forEach((config) => {
    const settings = resolveSettings(config.study_notice_settings);
    if (config.study_daily_enabled && now.minuteOfDay >= timeToMinutes(settings.daily_send_time)) {
      tasks.push({
        kind: 'daily',
        config,
        settings,
        targetDate: addDays(now.date, settings.daily_lead_days)
      });
    }
    const weekMonday = nextMonday(now.date);
    const weekSunday = addDays(weekMonday, 6);
    if (
      config.study_weekly_course_enabled &&
      now.dayOfWeek === settings.weekly_course_weekday &&
      now.minuteOfDay >= timeToMinutes(settings.weekly_course_send_time)
    ) {
      tasks.push({ kind: 'weekly_course', config, settings, weekMonday, weekSunday });
    }
    if (
      config.study_weekly_assignment_enabled &&
      now.dayOfWeek === settings.weekly_assignment_weekday &&
      now.minuteOfDay >= timeToMinutes(settings.weekly_assignment_send_time)
    ) {
      tasks.push({ kind: 'weekly_assignment', config, settings, weekMonday, weekSunday });
    }
  });
  return tasks;
}

function buildPreviewTasks(config: ClassStudyConfig, targetDate: string): StudyTask[] {
  const settings = resolveSettings(config.study_notice_settings);
  const weekMonday = getWeekday(targetDate) === 1 ? targetDate : addDays(targetDate, 1 - getWeekday(targetDate));
  return [
    { kind: 'daily', config, settings, targetDate },
    {
      kind: 'weekly_course',
      config,
      settings,
      weekMonday,
      weekSunday: addDays(weekMonday, 6)
    },
    {
      kind: 'weekly_assignment',
      config,
      settings,
      weekMonday,
      weekSunday: addDays(weekMonday, 6)
    }
  ];
}

function getTaskDateRange(tasks: StudyTask[]): { startDate: string; endDate: string } {
  const dates: string[] = [];
  tasks.forEach((task) => {
    if (task.targetDate) dates.push(task.targetDate);
    if (task.weekMonday) dates.push(task.weekMonday);
    if (task.weekSunday) dates.push(task.weekSunday);
  });
  dates.sort();
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

function buildCandidates(tasks: StudyTask[], data: StudyData): NotificationCandidate[] {
  return tasks.flatMap((task) => {
    if (task.kind === 'daily') return buildDailyCandidates(task, data);
    if (task.kind === 'weekly_course') {
      const candidate = buildWeeklyCourseCandidate(task, data);
      return candidate ? [candidate] : [];
    }
    const candidate = buildWeeklyAssignmentCandidate(task, data);
    return candidate ? [candidate] : [];
  });
}

async function getCurrentSemester(client: SupabaseClientLike) {
  const result = await client.from('semesters').select('id,semester_name').eq('is_current', 1).limit(1);
  if (result.error) throw result.error;
  return result.data?.[0] || null;
}

async function getStudyConfigs(
  client: SupabaseClientLike,
  semesterId: number,
  previewOrgId?: number
): Promise<ClassStudyConfig[]> {
  let query = client
    .from('organization_webhook_configs')
    .select(
      'org_id,study_daily_enabled,study_weekly_course_enabled,study_weekly_assignment_enabled,study_notice_settings'
    )
    .eq('semester_id', semesterId);
  if (previewOrgId) {
    query = query.eq('org_id', previewOrgId);
  } else {
    query = query
      .eq('enabled', true)
      .or('study_daily_enabled.eq.true,study_weekly_course_enabled.eq.true,study_weekly_assignment_enabled.eq.true');
  }
  const result = await query;
  if (result.error) throw result.error;
  return (result.data || []) as ClassStudyConfig[];
}

export async function produceStudyNotifications(
  client: SupabaseClientLike,
  now: BeijingNow
): Promise<{ eligible: number; candidates: number; created: number; duplicates: number }> {
  const semester = await getCurrentSemester(client);
  if (!semester) return { eligible: 0, candidates: 0, created: 0, duplicates: 0 };
  const configs = await getStudyConfigs(client, Number(semester.id));
  const tasks = buildTasks(configs, now);
  if (!tasks.length) return { eligible: configs.length, candidates: 0, created: 0, duplicates: 0 };
  const range = getTaskDateRange(tasks);
  const data = await loadStudyData(
    client,
    Number(semester.id),
    String(semester.semester_name || ''),
    configs,
    range.startDate,
    range.endDate
  );
  const candidates = buildCandidates(tasks, data).flatMap(expandCandidate);
  let created = 0;
  let duplicates = 0;
  for (const candidate of candidates) {
    const result = await client.from('organization_notification_outbox').insert({
      semester_id: Number(semester.id),
      org_id: candidate.orgId,
      module_key: 'study',
      event_key: candidate.eventKey,
      title: candidate.title,
      content: candidate.content,
      dedupe_key: candidate.dedupeKey
    });
    if (!result.error) {
      created++;
    } else if (result.error.code === '23505') {
      duplicates++;
    } else {
      throw result.error;
    }
  }
  return { eligible: configs.length, candidates: candidates.length, created, duplicates };
}

export async function previewStudyNotifications(
  client: SupabaseClientLike,
  orgId: number,
  targetDate: string
): Promise<{
  orgId: number;
  targetDate: string;
  notifications: Array<{ eventKey: string; title: string; content: string; dedupeKey: string }>;
}> {
  const semester = await getCurrentSemester(client);
  if (!semester) return { orgId, targetDate, notifications: [] };
  const configs = await getStudyConfigs(client, Number(semester.id), orgId);
  if (!configs.length) return { orgId, targetDate, notifications: [] };
  const tasks = buildPreviewTasks(configs[0], targetDate);
  const range = getTaskDateRange(tasks);
  const data = await loadStudyData(
    client,
    Number(semester.id),
    String(semester.semester_name || ''),
    configs,
    range.startDate,
    range.endDate
  );
  const notifications = buildCandidates(tasks, data)
    .flatMap(expandCandidate)
    .map((candidate) => ({
      eventKey: candidate.eventKey,
      title: candidate.title,
      content: candidate.content,
      dedupeKey: candidate.dedupeKey
    }));
  return { orgId, targetDate, notifications };
}
