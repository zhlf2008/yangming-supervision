-- ============================================================
-- 增加"文化自信民族复兴"课程合集及章节
-- 数据来源：E:\Desktop\文化自信民族复兴.xlsx（读书目录）
-- 电子书链接为微信公众号文章（原表格中 embedded hyperlinks）
-- ============================================================

-- 1. 插入课程合集
INSERT INTO study_courses (title, description, sort_order)
VALUES ('文化自信民族复兴', '文化自信与民族复兴经典读本，13章完整课程', 2);

-- 2. 插入章节
DO $$
DECLARE
  v_course_id BIGINT;
BEGIN
  SELECT id INTO v_course_id FROM study_courses WHERE title = '文化自信民族复兴' ORDER BY id DESC LIMIT 1;

  INSERT INTO study_course_library (course_id, chapter_no, chapter_title, theme, title, paper_pages, ebook_url, sort_order) VALUES
  (v_course_id, 'W001', '第一周', '', '文化自信民族复兴', 'P001-P014', 'https://mp.weixin.qq.com/s/_i7xvNohxkca23CV0MsSiA', 1),
  (v_course_id, 'W002', '第二周', '', '文化自信民族复兴', 'P015-P033', 'https://mp.weixin.qq.com/s/-BQG3yJsOhw7sXyfbSA3VQ', 2),
  (v_course_id, 'W003', '第三周', '', '文化自信民族复兴', 'P034-P047', 'https://mp.weixin.qq.com/s/7sSqTL8mrBGuI6XOOc76dg', 3),
  (v_course_id, 'W004', '第四周', '', '文化自信民族复兴', 'P048-P060', 'https://mp.weixin.qq.com/s/pEMprFMg1_BkxqsdvpqV4A', 4),
  (v_course_id, 'W005', '第五周', '', '文化自信民族复兴', 'P061-P068', 'https://mp.weixin.qq.com/s/Z7glgKLUes3mCpq-d11Ijg', 5),
  (v_course_id, 'W006', '第六周', '', '文化自信民族复兴', 'P069-P088', 'https://mp.weixin.qq.com/s/5bATcbQ-8P5-ZYQlDg5rig', 6),
  (v_course_id, 'W007', '第七周', '', '文化自信民族复兴', 'P089-P102', 'https://mp.weixin.qq.com/s/JhWN1kJZU1CRyDVc3tn-DA', 7),
  (v_course_id, 'W008', '第八周', '', '文化自信民族复兴', 'P103-P115', 'https://mp.weixin.qq.com/s/1W782tBzwOXmBjXuBowlAg', 8),
  (v_course_id, 'W009', '第九周', '', '文化自信民族复兴', 'P117-P128', 'https://mp.weixin.qq.com/s/qxhwClQIes2cf08T436SwQ', 9),
  (v_course_id, 'W010', '第十周', '', '文化自信民族复兴', 'P129-P135', 'https://mp.weixin.qq.com/s/z9WsIxgyUqiathQi0KTo_g', 10),
  (v_course_id, 'W011', '第十一周', '', '文化自信民族复兴', 'P136-P141', 'https://mp.weixin.qq.com/s/eFaM4jS0ym7m8vCQhSd4eg', 11),
  (v_course_id, 'W012', '第十二周', '', '文化自信民族复兴', 'P142-P147', 'https://mp.weixin.qq.com/s/UZRH1Sw8Arg88dUidGAPYQ', 12),
  (v_course_id, 'W013', '第十三周', '', '文化自信民族复兴', 'P149-P161', 'https://mp.weixin.qq.com/s/kGGD3nAtFWn_jw25EIJOtA', 13);
END $$;
