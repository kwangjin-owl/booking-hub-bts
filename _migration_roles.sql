-- Supabase SQL Editor 에 통째로 붙여넣고 Run.
-- 기존 bookings 표를 지우지 않는다. 컬럼을 더하고 정책만 바꾼다.

-- 1) 주인을 기록할 칸과, 구글 캘린더 일정 id 를 담을 칸을 더한다.
alter table bookings
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists calendar_event_id text;

-- 2) 이미 들어 있는 예약 5건은 주인이 없다. 관리자 것으로 넘긴다.
--    아래 이메일이 본인 계정이 맞는지 확인하고 Run 한다.
update bookings
set user_id = (select id from auth.users where email = 'kwangjin.owl@gmail.com')
where user_id is null;

-- 3) 관리자인지 판별하는 함수. 이메일을 한 곳에서만 관리하려고 함수로 뺀다.
--    나중에 관리자를 늘리려면 in ('a@x.com','b@x.com') 형태로 고친다.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select auth.jwt() ->> 'email') = 'kwangjin.owl@gmail.com',
    false
  );
$$;

-- 4) 실습용으로 열어 뒀던 anon 정책 세 개를 걷어낸다.
drop policy if exists "demo read" on bookings;
drop policy if exists "demo insert" on bookings;
drop policy if exists "demo update" on bookings;

-- 혹시 이 스크립트를 두 번 돌려도 되도록 새 정책도 미리 지운다.
drop policy if exists "read own or admin" on bookings;
drop policy if exists "insert own" on bookings;
drop policy if exists "update admin only" on bookings;
drop policy if exists "delete admin only" on bookings;

-- 5) 로그인한 사용자만, 그리고 각자 권한만큼만 연다.

-- 읽기: 관리자는 전부, 그 외에는 자기가 넣은 것만
create policy "read own or admin" on bookings
  for select to authenticated
  using (is_admin() or user_id = auth.uid());

-- 쓰기: 누구나 예약할 수 있지만 user_id 를 남의 것으로 못 쓴다.
--       status 는 항상 pending 으로 들어간다.
create policy "insert own" on bookings
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- 수정: 관리자만
create policy "update admin only" on bookings
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- 삭제: 관리자만
create policy "delete admin only" on bookings
  for delete to authenticated
  using (is_admin());

-- 6) 확인용. 정책 4개가 나오면 성공이다.
select policyname, cmd from pg_policies where tablename = 'bookings' order by policyname;
