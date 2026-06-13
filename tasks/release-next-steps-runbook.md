# Release Next Steps Runbook

Last updated: 2026-06-14

This file is the current handoff plan for PR #1 after the browser automation and
`admin-user` security follow-up.

## Current State

- PR: https://github.com/zhlf2008/yangming-supervision/pull/1
- Branch: `codex/platform-migration-audit`
- Preview: https://codex-platform-migration-aud.yangming-supervision.pages.dev
- Current recommendation: keep PR #1 as Draft.

Completed:

- Production database core gate was rechecked with Supabase management SQL.
- Previous `people/module_memberships = 0` result was identified as an anon key + RLS
  visibility issue, not final evidence of failed migration.
- Preview HTTP/static asset check passed: 17 key pages returned 200 and same-origin
  CSS/JS assets returned 200.
- `admin-user` Edge Function was secured and deployed:
  - commit: `603a596 fix: require auth for admin user function`
  - deployed function version: `16`
  - `verify_jwt=true`
  - no Authorization header returns 401
  - publishable/anon key returns 401
- Manual Preview checklist exists at `tasks/manual-preview-regression-checklist.md`.

Still blocking Ready:

- No long-term current-semester `secretariat` test account is available.
- No long-term current-semester `study` test account is available.
- No safe no-current-semester test account is available.
- Real Chrome/manual Preview regression has not been completed.

## Hard Stop Rules

Do not move PR #1 out of Draft if any of these are true:

- Any required long-term test account is missing.
- A real business account would need to be stripped of permissions to test blocking.
- Any key Preview page has a blank screen or blocking console error.
- `admin-user` no longer has `verify_jwt=true`.
- `temp_regression_*` permissions remain in production.
- The working tree is dirty or local checks fail.

## Step 1: Sync And Baseline

Run locally:

```powershell
git fetch origin
git switch codex/platform-migration-audit
git pull --ff-only
npm.cmd run lint
git diff --check main..HEAD
git status --short --branch
```

Expected:

- lint reports 0 errors and 0 warnings.
- `git diff --check main..HEAD` prints no errors.
- branch is clean and synced with origin.

## Step 2: Recheck `admin-user` Safety

Check the deployed function metadata:

```powershell
npx supabase functions deploy --help
```

Use Supabase dashboard or connector to confirm:

```text
project = whvjfurrkusdwujjodwc
function = admin-user
status = ACTIVE
verify_jwt = true
version >= 16
```

Run public-call checks:

```powershell
$url = 'https://whvjfurrkusdwujjodwc.supabase.co/functions/v1/admin-user'
Invoke-WebRequest -Uri $url -Method POST -ContentType 'application/json' -Body '{"action":"noop"}'
```

Expected:

```text
401 UNAUTHORIZED_NO_AUTH_HEADER
```

Then test with the publishable key only:

```powershell
$anon = 'sb_publishable_EpIHYcBxeuhS4eCHGaUk9w_ZVYN1Jn_'
Invoke-WebRequest -Uri $url -Method POST -ContentType 'application/json' -Headers @{ Authorization = "Bearer $anon" } -Body '{"action":"noop"}'
```

Expected:

```text
401 {"error":"登录状态无效"}
```

If either call succeeds, stop and fix `admin-user` before continuing.

## Step 3: Read-Only Database Gate

Run with Supabase management SQL or service-role visibility. Do not use anon-key
results as the final migration signal.

```sql
with current_semester as (
  select id, semester_name
  from semesters
  where is_current = 1
)
select 'current_semester_count' as metric, count(*)::text as value
from current_semester
union all
select 'people', count(*)::text from people
union all
select 'person_org_assignments_active', count(*)::text
from person_org_assignments where status = 'active'
union all
select 'module_memberships_enabled', count(*)::text
from module_memberships where enabled = true
union all
select 'temp_regression_left', count(*)::text
from module_memberships
where role in ('temp_regression_secretariat', 'temp_regression_study')
union all
select 'schedules_without_semester', count(*)::text
from schedules where semester_id is null
union all
select 'orphan_attendance', count(*)::text
from attendance_records ar
left join schedules s on s.id = ar.schedule_id
where s.id is null;
```

Also check module distribution for the current semester:

```sql
select mm.module_key, mm.role, count(*) as count
from module_memberships mm
join semesters s on s.id = mm.semester_id and s.is_current = 1
where mm.enabled = true
group by mm.module_key, mm.role
order by mm.module_key, mm.role;
```

Expected before test-account creation:

- `current_semester_count = 1`
- `people > 0`
- `person_org_assignments_active > 0`
- `module_memberships_enabled > 0`
- `temp_regression_left = 0`
- `schedules_without_semester = 0`
- `orphan_attendance = 0`

Current known account gap as of 2026-06-14:

- current semester has `supervision=115`
- no long-term `secretariat` membership
- no long-term `study` membership
- no active Auth user without current-semester membership

## Step 4: Prepare Long-Term Test Accounts

Prepare four account categories. Use dedicated test accounts only.

| Account | Required current-semester membership | Purpose |
| --- | --- | --- |
| Supervision | `module_key='supervision'` | Verify legacy supervision flow |
| Secretariat | `module_key='secretariat'` | Verify secretariat access |
| Study | `module_key='study'` | Verify study access |
| No current semester | none | Verify blocking behavior |

Recommended naming:

```text
回归测试-督察-YYYYMMDD
回归测试-秘书处-YYYYMMDD
回归测试-学委-YYYYMMDD
回归测试-无权限-YYYYMMDD
```

Keep credentials out of Git and PR comments. Record only account category and masked
phone/email, such as `***1234`.

Preferred creation path:

1. Use an admin account in the application or Supabase Dashboard to create Auth users.
2. Ensure each account has a matching `profiles` row.
3. Ensure module users have matching `people` rows.
4. Ensure module users have current-semester `person_org_assignments` where needed.
5. Insert or configure current-semester `module_memberships`.

Validation SQL after accounts are prepared:

```sql
with current_semester as (
  select id from semesters where is_current = 1
),
target_profiles as (
  select id, name, right(coalesce(phone, ''), 4) as phone_last4
  from profiles
  where name like '回归测试-%'
)
select
  p.name,
  p.phone_last4,
  coalesce(mm.module_key, '(none)') as module_key,
  coalesce(mm.role, '(none)') as role,
  mm.enabled
from target_profiles p
left join module_memberships mm
  on mm.user_id = p.id
 and mm.semester_id = (select id from current_semester)
order by p.name, mm.module_key;
```

Expected:

- supervision test account has `supervision`.
- secretariat test account has `secretariat`.
- study test account has `study`.
- no-current-semester test account has `(none)`.

## Step 5: Manual Preview Regression

Use `tasks/manual-preview-regression-checklist.md`.

Minimum browser setup:

1. Open the Preview URL in Chrome.
2. Open DevTools Console.
3. Enable "Preserve log".
4. Hard refresh each page before checking it.
5. Record blocking red console errors.

Required pass criteria:

- `/login` shows the login form while signed out.
- `/portal` shows only allowed module entries for each account.
- all 17 key pages open with no blank screen.
- supervision user can enter supervision pages.
- secretariat user can enter secretariat pages.
- study user can enter study pages.
- no-current-semester user is blocked from protected modules.
- admin user can see audit/platform management entry points.

If any page fails, keep PR #1 as Draft and record:

- account category
- page URL
- expected result
- actual result
- console error
- screenshot if available

## Step 6: Update PR And Move To Ready

Only after Steps 1-5 pass, post a PR comment using this template:

```text
Release Cycle 1 manual gate completed on YYYY-MM-DD.

- admin-user safety rechecked: passed
- database gate rechecked: passed
- long-term test accounts:
  - supervision: ***1234
  - secretariat: ***1234
  - study: ***1234
  - no-current-semester: ***1234
- Preview manual regression:
  - 17/17 pages passed
  - blocking console errors: none
  - permission checks: passed

Conclusion: PR #1 can be moved from Draft to Ready.
```

Then move PR #1 from Draft to Ready.

## Step 7: Merge And Production Verification

After PR is Ready and reviewed:

1. Merge PR #1 into `main`.
2. Wait for Cloudflare Pages production deploy to finish.
3. Open production URL in Chrome.
4. Repeat a shorter production smoke:
   - login page
   - portal
   - supervision dashboard
   - attendance page
   - summary page
   - secretariat dashboard
   - secretariat people page
   - study dashboard
   - study schedule rules
   - audit log
5. Log in with each long-term test account category.
6. Confirm no-current-semester account is blocked.
7. Watch Supabase Auth/function errors and user feedback for 30 minutes.

## Rollback Guidance

If the issue is a static frontend deploy problem:

- roll back Cloudflare Pages to the previous known-good `main` deployment.

If the issue is authorization or account data:

- do not roll back code first.
- inspect `profiles`, `people`, `person_org_assignments`, and `module_memberships`.
- confirm `semesters.is_current` and `semesters.effective_at`.

If `admin-user` becomes publicly callable again:

- redeploy the secured function.
- confirm `verify_jwt=true`.
- retest no-token and publishable-key requests.

## What Not To Do

- Do not use a real business account for no-permission testing.
- Do not leave `temp_regression_*` memberships in production.
- Do not publish credentials in Git, docs, PR comments, screenshots, or chat.
- Do not trust anon-key database gate output for migration completeness.
- Do not move the PR out of Draft based only on HTTP 200 checks.
