-- Supabase SQL Editor 에 통째로 붙여넣고 Run.
--
-- 슬롯 모델로 바꾸면서 필요한 칸을 더한다. 기존 행은 지우지 않는다.
-- 두 번 돌려도 안전하도록 전부 if not exists 다.

-- 1) 예약 입력 칸
alter table bookings
  add column if not exists kind          text,   -- 서울 / 경기 / 지방 / 내부
  add column if not exists form          text,   -- 외근 / 온라인
  add column if not exists memo          text,
  add column if not exists slots_wanted  text;   -- "오전,오후-1" 체크한 순서

-- 2) 판정 결과 칸
alter table bookings
  add column if not exists decision      text not null default 'pending',
  add column if not exists reason        text,
  add column if not exists options       text,   -- 기각: 빈 칸 목록 / 검토: 고객사 둘
  add column if not exists candidate     text,   -- 대기(자동 off)일 때 확정 버튼이 쓸 후보 칸
  add column if not exists slot_assigned text,   -- 확정된 칸. "오후-1,오후-2"
  add column if not exists trace         text;   -- 판정 과정. 줄바꿈으로 이어붙임

-- 3) 시간 칸은 더 이상 안 쓴다. not null 이라 빈 문자열이 기본값이 되게 한다.
alter table bookings alter column time set default '';

-- 4) 슬롯 모델 이전에 만들어진 예약. 확정된 것은 수동 확정으로, 나머지는 대기로 둔다.
--    slot_assigned 가 없으므로 칸을 점유하지는 않는다.
update bookings set decision = 'confirmed_human'
  where status = 'confirmed' and decision = 'pending' and kind is null;

-- 5) 대시보드가 postgres_changes 로 듣는다. 발행 목록에 없으면 이벤트가 오지 않는다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table bookings;
  end if;
end $$;

-- 6) UPDATE 이벤트에 바뀌기 전 값(old.decision)도 실어 보낸다.
--    이게 없으면 old 에 id 만 와서 "어느 화살표를 지나갔는지" 를 알 수 없다.
alter table bookings replica identity full;

-- 확인
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'bookings'
order by ordinal_position;
