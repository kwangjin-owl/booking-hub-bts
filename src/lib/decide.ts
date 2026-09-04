/**
 * 예약 하나를 판정한다. 비교와 집합 연산뿐이다 - LLM 도, 네트워크도 없다.
 *
 * 순서대로 딱 하나를 답한다.
 *   1 빈 칸            -> asking
 *   2 필요한 칸 계산
 *   3 그 날 달력
 *   4 후보 0개         -> rejected
 *   5 같은 날 동점     -> review
 *   결과               -> confirmed_auto (자동 on) / pending (자동 off)
 *
 * 판정 과정은 trace 에 한 줄씩 남긴다. 화면에서 "과정 보기" 로 그대로 보여주기 위해서다.
 */
import type { Decision } from './types'
import {
  SLOTS,
  type Slot,
  joinSlots,
  joinSlotsForDisplay,
  occupied,
  parseSlots,
  requiredSlots,
} from './slots'

/** decide 가 보는 최소 모양. bookings 표 한 줄을 그대로 넘겨도 된다. */
export interface DecideInput {
  id?: number
  customer?: string | null
  kind?: string | null
  date?: string | null
  slots_wanted?: string | null
  decision?: string | null
  slot_assigned?: string | null
}

export interface DecideResult {
  decision: Decision
  reason: string
  /** pending(자동 off)일 때 확정 버튼이 배정할 칸 */
  candidate?: Slot[]
  /** rejected: 그 날 빈 칸 / review: 고객사 둘 */
  options?: string[]
  slotAssigned?: Slot[]
  trace: string[]
}

/**
 * 희망 순서대로, 필요한 칸이 전부 비어 있는 후보를 모은다.
 * 같은 칸 묶음이 두 번 나오면 (경기 오후-1 과 오후-2 는 둘 다 오후-1+오후-2) 한 번만 센다.
 */
export function candidatesFor(booking: DecideInput, occ: Set<Slot>): Slot[][] {
  const kind = booking.kind ?? ''
  const wanted = parseSlots(booking.slots_wanted)
  const seen = new Set<string>()
  const out: Slot[][] = []
  for (const w of wanted) {
    const req = requiredSlots(kind, w)
    const key = joinSlots(req)
    if (seen.has(key)) continue
    seen.add(key)
    if (req.every((s) => !occ.has(s))) out.push(req)
  }
  return out
}

/** 그 예약을 뺀 나머지가 그 날 차지한 칸. 내 확정 칸은 내 것이니 비어 있는 것으로 본다. */
export function occupiedExcept(
  booking: DecideInput,
  allBookings: readonly DecideInput[],
): Set<Slot> {
  const date = booking.date ?? ''
  const others = allBookings.filter((b) => b.id == null || b.id !== booking.id)
  return occupied(
    date,
    others.map((b) => ({
      date: b.date ?? '',
      decision: b.decision ?? null,
      slot_assigned: b.slot_assigned ?? null,
    })),
  )
}

function overlaps(a: readonly Slot[], b: readonly Slot[]): boolean {
  return a.some((s) => b.includes(s))
}

export function decide(
  booking: DecideInput,
  allBookings: readonly DecideInput[],
  autoOn: boolean,
): DecideResult {
  const trace: string[] = []
  const wanted = parseSlots(booking.slots_wanted)
  const kind = booking.kind ?? ''
  const date = booking.date ?? ''

  // 1. 빈 칸
  const missing: string[] = []
  if (!kind) missing.push('종류')
  if (!date) missing.push('날짜')
  if (wanted.length === 0) missing.push('희망 슬롯')

  if (missing.length > 0) {
    const reason = `빈 칸: ${missing.join(', ')}`
    trace.push(`1 빈 칸 검사: ${missing.join(', ')}`)
    trace.push(`결과: 질문 - ${reason}`)
    return { decision: 'asking', reason, trace }
  }
  trace.push('1 빈 칸 검사: 없음')

  // 2. 필요한 칸
  const need = requiredSlots(kind, wanted[0]).length
  trace.push(`2 종류 ${kind} -> 필요한 칸 ${need}개 (희망 ${wanted.join(', ')})`)

  // 3. 그 날 달력
  const occ = occupiedExcept(booking, allBookings)
  trace.push(`3 ${date} 달력: ${SLOTS.map((s) => `${s} ${occ.has(s) ? 'X' : 'O'}`).join(', ')}`)

  // 4. 후보
  const candidates = candidatesFor(booking, occ)
  if (candidates.length === 0) {
    const free = SLOTS.filter((s) => !occ.has(s))
    const reason = '희망 슬롯 전부 찼음'
    trace.push('4 희망 순서대로 필요한 칸이 전부 O 인 후보: 없음')
    trace.push(`결과: 기각 - ${reason} (그 날 빈 칸: ${free.length ? free.join(', ') : '없음'})`)
    return { decision: 'rejected', reason, options: free, trace }
  }
  trace.push(
    `4 희망 순서대로 필요한 칸이 전부 O 인 후보: ${candidates.map(joinSlotsForDisplay).join(', ')}`,
  )

  // 5. 같은 날 아직 자리를 못 받은 다른 요청과 비교.
  //    상대의 후보가 하나뿐이면 그 상대는 물러설 곳이 없다. 그 칸은 건드리지 않는다.
  //    나는 다른 후보가 있으면 그리로 양보한다 - 양쪽 다 갈 곳이 없을 때만 사람을 부른다.
  //    (전에는 내 첫 후보만 보고 검토로 넘겨, 비켜 갈 수 있는데도 사람을 부르는 일이 많았다)
  const rivals = allBookings.filter(
    (b) =>
      (b.id == null || b.id !== booking.id) &&
      b.date === date &&
      (b.decision === 'pending' || b.decision === 'review') &&
      !!b.kind &&
      parseSlots(b.slots_wanted).length > 0,
  )

  const locked: { customer: string; slots: Slot[] }[] = []
  for (const r of rivals) {
    const rc = candidatesFor(r, occ)
    if (rc.length === 1) {
      locked.push({ customer: r.customer || '다른 예약', slots: rc[0] })
    }
  }

  if (locked.length === 0) {
    trace.push(
      rivals.length === 0
        ? '5 같은 날 대기 요청 비교: 대기 요청 없음'
        : '5 같은 날 대기 요청 비교: 물러설 곳 없는 요청 없음',
    )
  } else {
    trace.push(
      `5 같은 날 대기 요청 비교: 물러설 곳 없는 요청 - ${locked
        .map((l) => `${l.customer}(${joinSlotsForDisplay(l.slots)})`)
        .join(', ')}`,
    )
  }

  // 상대가 잠근 칸을 피할 수 있는 내 후보
  const free = candidates.find((c) => !locked.some((l) => overlaps(l.slots, c)))

  if (!free) {
    // 내 후보 전부가 물러설 곳 없는 상대와 겹친다. 이제야 사람이 고를 일이다.
    const blockers = [
      ...new Set(
        locked
          .filter((l) => candidates.some((c) => overlaps(l.slots, c)))
          .map((l) => l.customer),
      ),
    ]
    const me = booking.customer || '이 예약'
    const reason = `동점 - ${blockers.join(', ')} 도 같은 칸이 유일 후보`
    trace.push(`5-1 내 후보 ${candidates.map(joinSlotsForDisplay).join(', ')} 이 모두 겹침 - 양보할 곳 없음`)
    trace.push(`결과: 검토 - ${reason}`)
    return { decision: 'review', reason, options: [me, ...blockers], trace }
  }

  if (free !== candidates[0]) {
    trace.push(`5-1 첫 후보는 겹쳐서 양보 - ${joinSlotsForDisplay(free)} 로 비켜 감`)
  }

  // 결과
  const first = free
  const shown = joinSlotsForDisplay(first)
  if (autoOn) {
    const reason = `빈 칸 ${shown} 확정`
    trace.push(`결과: 확정-자동 - ${reason}`)
    return { decision: 'confirmed_auto', reason, slotAssigned: first, trace }
  }
  const reason = `후보 ${shown} - 확정 버튼 대기`
  trace.push(`결과: 대기 - ${reason}`)
  return { decision: 'pending', reason, candidate: first, trace }
}

/** bookings 표에 저장할 모양. 저장하는 곳이 여럿이라 변환은 여기 한 곳에서만 한다. */
export function toBookingPatch(result: DecideResult) {
  return {
    decision: result.decision,
    reason: result.reason,
    options: result.options && result.options.length ? result.options.join(',') : null,
    candidate: result.candidate ? joinSlots(result.candidate) : null,
    slot_assigned: result.slotAssigned ? joinSlots(result.slotAssigned) : null,
    trace: result.trace.join('\n'),
  }
}
