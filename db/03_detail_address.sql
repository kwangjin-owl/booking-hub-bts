-- Supabase SQL Editor 에 붙여넣고 Run.
-- 상세주소(동·호수·층)를 담을 칸을 더한다.
-- 지도 검색으로는 건물까지만 알 수 있어, 그 뒤는 직접 적어야 한다.

alter table bookings
  add column if not exists detail_address text;

-- 확인
select column_name, data_type
from information_schema.columns
where table_name = 'bookings'
order by ordinal_position;
