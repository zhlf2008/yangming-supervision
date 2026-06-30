-- Optimize the people management pending-entry list.
-- The UI filters active entry forms by semester and orders by newest submission.

CREATE INDEX IF NOT EXISTS idx_entry_forms_active_pending_order
ON entry_forms (semester_id, submitted_at DESC, id DESC)
WHERE status = 'active';
