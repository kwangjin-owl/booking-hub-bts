/**
 * decide 를 돌리고 결과를 bookings 에 저장하는 것까지를 한 곳에서 한다.
 * 예약 추가·미확정 관리·전부 판정 세 곳이 같은 코드를 타야 결과가 어긋나지 않는다.
 *
 * 저장은 RLS 때문에 관리자만 된다. 일반 사용자는 pending 으로 두고 관리자가 판정한다.
 */
import { supabase } from '../supabaseClient'
import { decide, toBookingPatch, type DecideResult } from './decide'
import { parseSlots, type Slot } from './slots'
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

/** 아직 자리를 못 받은 상태들. 확정된 것은 건드리지 않는다. */
const UNSETTLED = ['pending', 'review', 'rejected', 'asking']

/**
 * 여러 건을 접수 순서대로 판정한다.
 *
 * 한 건 저장할 때마다 목록을 갈아끼운다.
 * 그래야 앞 건이 확정한 칸을 뒷 건이 보고 피한다.
 */
export async function judgeMany(
  ids: number[],
  autoOn: boolean,
): Promise<{ judged: number; calendarErrors: string[] }> {
  let all = await fetchAllBookings()
  const order = all.filter((b) => ids.includes(b.id)).map((b) => b.id)
  const calendarErrors: string[] = []

  for (const id of order) {
    const current = all.find((b) => b.id === id)
    if (!current) continue
    const { row, calendarError } = await judgeAndSave(current, all, autoOn)
    if (calendarError) calendarErrors.push(calendarError)
    all = all.map((b) => (b.id === id ? row : b))
  }
  return { judged: order.length, calendarErrors }
}

/**
 * 아직 자리를 못 받은 예약을 전부 판정한다.
 *
 * 전에는 pending 만 돌려서, 충돌이 풀린 뒤에도 검토·기각 줄이 그대로 남아
 * 한 건씩 손으로 눌러야 했다. 이제 네 상태를 다 다시 본다.
 */
export async function judgeAllPending(
  autoOn: boolean,
): Promise<{ judged: number; calendarErrors: string[] }> {
  const all = await fetchAllBookings()
  const ids = all.filter((b) => UNSETTLED.includes(b.decision ?? 'pending')).map((b) => b.id)
  return judgeMany(ids, autoOn)
}

export interface SlotOverlap {
  date: string
  slot: Slot
  bookings: BookingRow[]
}

/**
 * 같은 날 같은 칸에 확정이 둘 이상 들어간 곳을 찾는다.
 *
 * 판정이 제대로 돌면 생기지 않아야 하지만,
 * 낡은 후보로 확정하거나 옛 데이터가 섞이면 조용히 겹칠 수 있다.
 * 조용히 겹치는 것이 가장 위험하므로 화면에 드러낸다.
 */
export function findSlotOverlaps(bookings: readonly BookingRow[]): SlotOverlap[] {
  const bucket = new Map<string, BookingRow[]>()

  for (const b of bookings) {
    if (b.decision !== 'confirmed_auto' && b.decision !== 'confirmed_human') continue
    for (const slot of parseSlots(b.slot_assigned)) {
      const key = `${b.date}|${slot}`
      const list = bucket.get(key) ?? []
      list.push(b)
      bucket.set(key, list)
    }
  }

  const out: SlotOverlap[] = []
  for (const [key, list] of bucket) {
    if (list.length < 2) continue
    const [date, slot] = key.split('|')
    out.push({
      date,
      slot: slot as Slot,
      // 먼저 접수한 쪽이 자리를 지킨다
      bookings: [...list].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
