-- ============================================================
-- 晨读长图素材权限：按照片来源小组授权宣委管理
-- ============================================================

DROP POLICY IF EXISTS "宣委可查看晨读长图素材" ON publicity_reading_poster_items;
CREATE POLICY "宣委可查看晨读长图素材"
ON publicity_reading_poster_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM publicity_reading_posters poster
    WHERE poster.id = publicity_reading_poster_items.poster_id
      AND (
        app_private.has_module_org_scope(
          poster.semester_id, 'publicity', poster.source_org_id, NULL
        )
        OR app_private.has_module_org_scope(
          poster.semester_id, 'publicity', poster.org_id, NULL
        )
      )
  )
);

DROP POLICY IF EXISTS "宣委可管理晨读长图素材" ON publicity_reading_poster_items;
CREATE POLICY "宣委可管理晨读长图素材"
ON publicity_reading_poster_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM publicity_reading_posters poster
    WHERE poster.id = publicity_reading_poster_items.poster_id
      AND (
        app_private.has_module_org_scope(
          poster.semester_id, 'publicity', poster.source_org_id, NULL
        )
        OR app_private.has_module_org_scope(
          poster.semester_id, 'publicity', poster.org_id, NULL
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM publicity_reading_posters poster
    WHERE poster.id = publicity_reading_poster_items.poster_id
      AND (
        app_private.has_module_org_scope(
          poster.semester_id, 'publicity', poster.source_org_id, NULL
        )
        OR app_private.has_module_org_scope(
          poster.semester_id, 'publicity', poster.org_id, NULL
        )
      )
  )
);
