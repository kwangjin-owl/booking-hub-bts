-- Supabase SQL Editor 에 통째로 붙여넣고 Run.
--
-- 하이쿠 작업 때 슬롯이 영어 id (morning / afternoon1 / afternoon2) 로 저장됐다.
-- 판정은 한글 이름(오전 / 오후-1 / 오후-2)을 찾으므로 그대로 두면
-- 화면에 "희망: 없음" 이 뜨고 판정이 계속 어긋난다. 한 번만 정리한다.

-- 1) 희망 슬롯과 배정된 칸을 한글로 바꾼다. 순서는 그대로 유지된다.
update bookings
set
  slots_wanted = replace(replace(replace(slots_wanted,
    'afternoon1', '오후-1'), 'afternoon2', '오후-2'), 'morning', '오전'),
  slot_assigned = replace(replace(replace(slot_assigned,
    'afternoon1', '오후-1'), 'afternoon2', '오후-2'), 'morning', '오전'),
  candidate = replace(replace(replace(candidate,
    'afternoon1', '오후-1'), 'afternoon2', '오후-2'), 'morning', '오전')
where slots_wanted like '%morning%' or slots_wanted like '%afternoon%'
   or slot_assigned like '%morning%' or slot_assigned like '%afternoon%'
   or candidate like '%morning%' or candidate like '%afternoon%';

-- 2) 옛 코드가 남긴 판정 결과를 지운다. 규칙이 달라졌으므로 이유·과정을 믿을 수 없다.
--    (체육 학원이 칸이 다 비었는데도 '기각' 으로 남아 있던 것이 이 경우다)
--    확정된 것은 건드리지 않는다. 나머지는 대기로 돌려 대시보드에서 '전부 판정' 을 누르면 된다.
update bookings
set decision = 'pending', reason = null, options = null, candidate = null, trace = null
where decision in ('pending', 'review', 'rejected', 'asking');

-- 확인. slots_wanted 에 영어가 남아 있으면 0 행이어야 한다.
select id, customer, slots_wanted, slot_assigned, decision
from bookings
where slots_wanted like '%morning%' or slots_wanted like '%afternoon%'
   or slot_assigned like '%morning%' or slot_assigned like '%afternoon%';
