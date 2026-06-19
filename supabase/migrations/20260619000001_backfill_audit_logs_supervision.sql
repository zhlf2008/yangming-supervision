-- ============================================================
-- Backfill legacy audit logs without module_key.
-- Before platform audit was split by module, existing logs all came from
-- the supervision system, so blank module_key values should be classified
-- as supervision instead of "unknown".
-- ============================================================

UPDATE audit_logs
SET module_key = 'supervision'
WHERE module_key IS NULL
   OR btrim(module_key) = '';
