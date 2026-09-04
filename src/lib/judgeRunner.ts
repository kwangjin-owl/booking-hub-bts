/**
 * decide 를 돌리고 결과를 bookings 에 저장하는 것까지를 한 곳에서 한다.
 * 예약 추가·미확정 관리·전부 판정 세 곳이 같은 코드를 타야 결과가 어긋나지 않는다.
 *
 * 저장은 RLS 때문에 관리자만 된다. 일반 사용자는 pending 으로 두고 관리자가 판정한다.
 */
import { supabase } from '../supabaseClient'
import { decide, toBookingPatch, type DecideResult } from './decide'
import { syncCalendar } from './calendarSync'
import type { BookingRow } from './types'

export const AUTO_JUDGE_KEY = 'auto-judge'

export function readAutoOn(): boolean {
  return localStorage.getItem(AUTO_JUDGE_KEY) !== 'false'
}

export function writeAutoOn(on: boolean) {
  localStorage.setItem(AUTO_JUDGE_KEY, on ? 'true' : 'false')
}

export async function fetchAllBookings(): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BookingRow[]
}

/**
 * 한 건을 판정하고 저장한다. 저장에 성공하면 새 모양의 행을 돌려준다.
 * allBookings 는 판정 직전의 전체 목록이어야 한다 - 앞 건이 확정한 칸을 뒷 건이 봐야 하므로,
 * 여러 건을 돌릴 때는 돌려받은 행으로 목록을 갈아끼우며 진행한다.
 */
export async function judgeAndSave(
  booking: BookingRow,
  allBookings: readonly BookingRow[],
  autoOn: boolean,
): Promise<{ result: DecideResult; row: BookingRow; calendarError?: string }> {
  const result = decide(booking, allBookings, autoOn)
  const patch = toBookingPatch(result)

  const { error } = await supabase.from('bookings').update(patch).eq('id', booking.id)
  if (error) throw new Error(error.message)

  // 확정이면 캘린더에 올리고, 확정이 풀렸으면 지운다.
  // 실패해도 판정은 그대로 둔다 - 일정은 다시 올릴 수 있지만 판정이 사라지면 배정이 꼬인다.
  const row = { ...booking, ...patch } as BookingRow
  const sync = await syncCalendar(row)

  return {
    result,
    row: { ...row, ...(sync.patch ?? {}) } as BookingRow,
    calendarError: sync.error,
  }
}

/** pending 인 예약을 접수 순서대로 전부 판정한다. 돌린 건수와 캘린더 실패를 돌려준다. */
export async function judgeAllPending(
  autoOn: boolean,
): Promise<{ judged: number; calendarErrors: string[] }> {
  let all = await fetchAllBookings()
  const targets = all.filter((b) => b.decision === 'pending').map((b) => b.id)
  const calendarErrors: string[] = []

  for (const id of targets) {
    const current = all.find((b) => b.id === id)
    if (!current) continue
    const { row, calendarError } = await judgeAndSave(current, all, autoOn)
    if (calendarError) calendarErrors.push(calendarError)
    all = all.map((b) => (b.id === id ? row : b))
  }
  return { judged: targets.length, calendarErrors }
}
