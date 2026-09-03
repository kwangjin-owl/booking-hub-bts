-- Supabase SQL Editor 에 붙여넣고 Run.
--
-- 겹치는 예약을 확인하는 함수.
--
-- 화면에서 직접 조회하면 RLS 때문에 자기 예약만 보인다.
-- 그러면 일반 사용자는 남이 잡아둔 시간을 알 수 없어, 겹치는데도
-- "문제 없음" 으로 보이는 잘못된 안심을 주게 된다.
--
-- security definer 로 만들어 전체를 보되, 일반 사용자에게는
-- 시각만 돌려주고 누구 예약인지는 감춘다.

create or replace function check_booking_conflicts(
  p_date text,
  p_time text,
  p_exclude_id bigint default null,
  p_gap_minutes int default 60
)
returns table (booking_time text, customer text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_minutes int;
begin
  -- 'HH:MM' 을 분으로 바꾼다. 형식이 이상하면 아무것도 돌려주지 않는다.
  begin
    target_minutes :=
      split_part(p_time, ':', 1)::int * 60 + split_part(p_time, ':', 2)::int;
  exception when others then
    return;
  end;

  return query
  select
    b.time as booking_time,
    -- 관리자에게만 고객사 이름을 보여준다. 그 외에는 시각만 알려준다.
    case when is_admin() then b.customer else '다른 예약' end as customer
  from bookings b
  where b.date = p_date
    and (p_exclude_id is null or b.id <> p_exclude_id)
    and abs(
      (split_part(b.time, ':', 1)::int * 60 + split_part(b.time, ':', 2)::int)
      - target_minutes
    ) < p_gap_minutes
  order by b.time;
end;
$$;

-- 로그인한 사용자만 부를 수 있다.
revoke all on function check_booking_conflicts(text, text, bigint, int) from public, anon;
grant execute on function check_booking_conflicts(text, text, bigint, int) to authenticated;

-- 확인
select * from check_booking_conflicts('2026-09-07', '18:00');
