-- 宣委可复用共读影像提交页，在授权组织范围内上传、修改和删除原图。

DROP POLICY IF EXISTS "学委可提交共读影像" ON public.study_reading_media_assets;
CREATE POLICY "学委和宣委可提交共读影像"
ON public.study_reading_media_assets FOR INSERT
TO authenticated
WITH CHECK (
  (
    app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
  )
  AND submitted_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "学委可修改共读影像" ON public.study_reading_media_assets;
CREATE POLICY "学委和宣委可修改共读影像"
ON public.study_reading_media_assets FOR UPDATE
TO authenticated
USING (
  app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
)
WITH CHECK (
  (
    app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
    OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
  )
  AND submitted_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "学委可删除共读影像" ON public.study_reading_media_assets;
CREATE POLICY "学委和宣委可删除共读影像"
ON public.study_reading_media_assets FOR DELETE
TO authenticated
USING (
  app_private.has_module_org_scope(semester_id, 'study', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'study', org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', source_org_id, NULL)
  OR app_private.has_module_org_scope(semester_id, 'publicity', org_id, NULL)
);

DROP POLICY IF EXISTS "学委可上传共读影像文件" ON storage.objects;
CREATE POLICY "学委和宣委可上传共读影像文件"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reading-media'
  AND (
    app_private.can_access_reading_media_object(name, 'study')
    OR app_private.can_access_reading_media_object(name, 'publicity')
  )
);

DROP POLICY IF EXISTS "学委可更新共读影像文件" ON storage.objects;
CREATE POLICY "学委和宣委可更新共读影像文件"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reading-media'
  AND (
    app_private.can_access_reading_media_object(name, 'study')
    OR app_private.can_access_reading_media_object(name, 'publicity')
  )
)
WITH CHECK (
  bucket_id = 'reading-media'
  AND (
    app_private.can_access_reading_media_object(name, 'study')
    OR app_private.can_access_reading_media_object(name, 'publicity')
  )
);

DROP POLICY IF EXISTS "学委可删除共读影像文件" ON storage.objects;
CREATE POLICY "学委和宣委可删除共读影像文件"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reading-media'
  AND (
    app_private.can_access_reading_media_object(name, 'study')
    OR app_private.can_access_reading_media_object(name, 'publicity')
  )
);
