import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export interface Conflict {
  booking_time: string
  customer: string
}

/**
 * 같은 날 비슷한 시간에 잡힌 예약을 찾는다.
 *
 * 테이블을 직접 조회하면 RLS 때문에 자기 예약만 보여, 남이 잡아둔 시간을 놓친다.
 * 그래서 전체를 보는 DB 함수(check_booking_conflicts)를 부른다.
 *
 * @param excludeId 수정 중인 예약. 자기 자신과 겹친다고 나오면 안 되므로 제외한다.
 */
export function useConflicts(date: string, time: string, excludeId?: number) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  useEffect(() => {
    if (!date || !time) {
      setConflicts([])
      return
    }

    let cancelled = false

    const check = async () => {
      const { data, error } = await supabase.rpc('check_booking_conflicts', {
        p_date: date,
        p_time: time,
        p_exclude_id: excludeId ?? null,
      })

      if (cancelled) return

      if (error) {
        // 함수를 아직 만들지 않았을 수도 있다. 경고만 못 볼 뿐 등록은 되어야 한다.
        console.warn('중복 확인 실패:', error.message)
        setConflicts([])
        return
      }

      setConflicts((data ?? []) as Conflict[])
    }

    check()
    return () => {
      cancelled = true
    }
  }, [date, time, excludeId])

  return conflicts
}
