-- 允许匿名用户提交进班表单（外部填写模式）
DROP POLICY IF EXISTS "外部可提交进班表单" ON entry_forms;
CREATE POLICY "外部可提交进班表单" ON entry_forms FOR INSERT
  WITH CHECK (true);
