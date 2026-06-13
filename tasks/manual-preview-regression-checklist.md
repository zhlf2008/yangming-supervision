# Manual Preview Regression Checklist

Use this checklist when Codex Chrome automation is unavailable but PR #1 still needs
real browser validation before leaving Draft.

For the full release handoff sequence, use
`tasks/release-next-steps-runbook.md`.

## Context

- PR: https://github.com/zhlf2008/yangming-supervision/pull/1
- Preview: https://codex-platform-migration-aud.yangming-supervision.pages.dev
- Reason for manual path: Codex Chrome plugin/native host is not currently usable,
  and automated browser access is blocked by local browser policy.

## Required Accounts

Do not use real business accounts for permission-removal tests.

Prepare or confirm these long-term test accounts:

| Account type | Required module permission | Expected result |
| --- | --- | --- |
| Supervision user | `supervision` for current semester | Can enter supervision pages |
| Secretariat user | `secretariat` for current semester | Can enter secretariat pages |
| Study user | `study` for current semester | Can enter study pages |
| No-current-semester user | none for current semester | Is blocked from protected modules |

If any of these accounts are missing, keep the PR as Draft.

## Browser Setup

Before opening the Preview, confirm `admin-user` is still protected:

- Supabase function `admin-user` has `verify_jwt=true`.
- no-token request returns 401.
- publishable/anon-key-only request returns 401.

1. Open the Preview URL in Chrome.
2. Open DevTools Console.
3. Enable "Preserve log".
4. Hard refresh each page before checking it.
5. Record any red console error that blocks rendering, login, routing, or data load.

Non-blocking warnings or expected 401/403 responses are acceptable only if the page
shows the correct user-facing blocked/unauthorized state.

## Page Smoke Matrix

Check these pages for no blank screen, correct title/main content, and no blocking JS
errors:

| Page | Account to use | Expected result |
| --- | --- | --- |
| `/login` | signed out | Login form is visible |
| `/portal` | each allowed account | Shows only allowed module entries |
| `/` | supervision or admin | Supervision dashboard opens |
| `/attendance-page` | supervision or admin | Attendance entry page opens |
| `/summary-page` | supervision or admin | Summary page opens |
| `/leaderboard` | supervision or admin | Leaderboard opens |
| `/schedule-management` | supervision or admin | Schedule management opens |
| `/profile` | any signed-in account | Profile page opens |
| `/secretariat-dashboard` | secretariat or admin | Secretariat dashboard opens |
| `/secretariat-org-management` | secretariat or admin | Organization management opens |
| `/secretariat-people` | secretariat or admin | People management opens |
| `/secretariat-entry-form` | secretariat or admin | Entry form page opens |
| `/study-dashboard` | study or admin | Study dashboard opens |
| `/study-course-library` | study or admin | Course library opens |
| `/study-schedule-rules` | study or admin | Schedule rules open |
| `/study-weekly-assignment` | study or admin | Weekly assignment opens |
| `/audit-log` | admin | Audit log opens |

## Permission Checks

Run these checks after the page smoke matrix:

1. Supervision user can enter supervision pages and cannot see unauthorized module
   entries.
2. Secretariat user can enter secretariat pages and cannot access unrelated protected
   pages.
3. Study user can enter study pages and cannot access unrelated protected pages.
4. No-current-semester user is blocked from protected modules and sees an appropriate
   unauthorized or redirect state.
5. Admin user can see platform management entries, including audit log.

## PR Comment Template

Post this after manual regression is complete:

```text
Manual Preview regression completed on YYYY-MM-DD:

- Preview URL:
  https://codex-platform-migration-aud.yangming-supervision.pages.dev
- Accounts covered:
  - supervision:
  - secretariat:
  - study:
  - no-current-semester:
  - admin:
- Page smoke matrix:
  17/17 passed
- Blocking console errors:
  none
- Permission checks:
  passed

Conclusion: PR #1 can be moved from Draft to Ready.
```

If any item fails, keep the PR as Draft and record the failing page, account type,
console error, and expected behavior.
