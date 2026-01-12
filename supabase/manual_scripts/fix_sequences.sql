-- =========================================================
-- 修复 ID 不连续的问题
-- =========================================================
-- 说明：
-- PostgreSQL 的序列 (Sequence) 在插入失败、回滚或删除数据时不会回退，
-- 这会导致 ID 出现跳号（不连续）。这是正常的数据库行为。
-- 如果您希望 ID 看起来是连续的（例如在清理测试数据后），
-- 可以运行以下 SQL 语句来重置序列到当前最大值。

-- 1. 重置用户 UID (user_code) 序列
-- 将序列设置为当前最大的 user_code 值。如果表中没有数据，则重置为 10000 (下一个是 10001)。
SELECT setval('public.user_code_seq', COALESCE((SELECT MAX(user_code) FROM public.profiles), 10000));

-- 2. 重置房间编号 (room_number) 序列
-- 将序列设置为当前最大的 room_number 值。如果表中没有数据，则重置为 0 (下一个是 1)。
SELECT setval('public.rooms_room_number_seq', COALESCE((SELECT MAX(room_number) FROM public.rooms), 0));

-- 执行后，下一个新创建的用户/房间将紧接着当前最大的号码。
