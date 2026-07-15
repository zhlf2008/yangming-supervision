DROP POLICY IF EXISTS "秘书处可管理班级群机器人配置" ON organization_webhook_configs;

DROP POLICY IF EXISTS "秘书处可新增班级群机器人配置" ON organization_webhook_configs;
CREATE POLICY "秘书处可新增班级群机器人配置"
  ON organization_webhook_configs FOR INSERT
  TO authenticated
  WITH CHECK (app_private.has_secretariat_org_scope(semester_id, org_id));

DROP POLICY IF EXISTS "秘书处可更新班级群机器人配置" ON organization_webhook_configs;
CREATE POLICY "秘书处可更新班级群机器人配置"
  ON organization_webhook_configs FOR UPDATE
  TO authenticated
  USING (app_private.has_secretariat_org_scope(semester_id, org_id))
  WITH CHECK (app_private.has_secretariat_org_scope(semester_id, org_id));

DROP POLICY IF EXISTS "秘书处可删除班级群机器人配置" ON organization_webhook_configs;
CREATE POLICY "秘书处可删除班级群机器人配置"
  ON organization_webhook_configs FOR DELETE
  TO authenticated
  USING (app_private.has_secretariat_org_scope(semester_id, org_id));
