import type { Booking as SlotBooking } from './slots'
import { SLOTS, requiredSlots, occupied } from './slots'

export interface Booking {
  id?: number
  kind: string
  date: string
  slots_wanted: string
  decision?: string
  slot_assigned?: string
  reason?: string
  options?: string
  trace?: string
  customer?: string
}

export interface DecideResult {
  decision: 'asking' | 'pending' | 'confirmed_auto' | 'confirmed_human' | 'review' | 'rejected'
  reason: string
  candidate?: string
  options?: string[]
  slotAssigned?: string
  trace: string[]
}

export function decide(booking: Booking, allBookings: Booking[], autoOn: boolean): DecideResult {
  const trace: string[] = []

  // 1. 빈 칸 검사
  const missing: string[] = []
  if (!booking.kind) missing.push('종류')
  if (!booking.date) missing.push('날짜')
  if (!booking.slots_wanted || booking.slots_wanted.split(',').length === 0) missing.push('희망 슬롯')

  if (missing.length > 0) {
    trace.push(`1 빈 칸 검사: ${missing.join(', ')}`)
    return {
      decision: 'asking',
      reason: `빈 칸: ${missing.join(', ')}`,
      trace,
    }
  }

  const wanted = booking.slots_wanted.split(',').map((s) => s.trim())
  trace.push(`1 빈 칸 검사: 없음`)

  // 2. 필요한 칸 계산
  const required = requiredSlots(booking.kind, wanted)
  trace.push(
    `2 종류 ${booking.kind} -> 필요한 칸 ${required.length}개 (희망 ${wanted.join(', ')})`
  )

  // 3. 그 날짜의 점유된 칸 확인
  const allBookingsTyped: SlotBooking[] = allBookings.map((b) => ({
    date: b.date,
    decision: b.decision || '',
    slot_assigned: b.slot_assigned,
  }))
  const occ = occupied(booking.date, allBookingsTyped)
  const daySlots = SLOTS.map((s) => (occ.has(s) ? '✓' : 'O'))
  trace.push(`3 ${booking.date} 달력: ${SLOTS.map((s, i) => `${s} ${daySlots[i]}`).join(', ')}`)

  // 4. 후보 찾기
  const candidates: string[] = []
  for (const w of wanted) {
    const req = requiredSlots(booking.kind, [w])
    const allFree = req.every((r) => !occ.has(r))
    if (allFree) {
      candidates.push(req.join('+'))
      break
    }
  }

  if (candidates.length === 0) {
    const available = SLOTS.filter((s) => !occ.has(s))
    trace.push(`4 희망 순서대로 필요한 칸이 전부 O인 후보: 없음`)
    return {
      decision: 'rejected',
      reason: '희망 슬롯 전부 찼음',
      options: available,
      trace,
    }
  }

  const firstCandidate = candidates[0]
  trace.push(`4 희망 순서대로 필요한 칸이 전부 O인 후보: ${firstCandidate}`)

  // 5. 같은 날짜의 다른 pending 예약 비교
  const sameDayPending = allBookings.filter(
    (b) =>
      b.date === booking.date &&
      b.decision === 'pending' &&
      b.id !== booking.id &&
      b.slots_wanted
  )

  let conflict: Booking | null = null
  for (const other of sameDayPending) {
    const otherWanted = other.slots_wanted.split(',').map((s) => s.trim())

    let otherFirstCandidate = ''

    for (const w of otherWanted) {
      const req = requiredSlots(other.kind, [w])
      const allFree = req.every((r) => !occ.has(r))
      if (allFree) {
        otherFirstCandidate = req.join('+')
        break
      }
    }

    if (otherFirstCandidate && otherFirstCandidate === firstCandidate) {
      conflict = other
      break
    }
  }

  if (conflict) {
    trace.push(
      `5 같은 날 대기 요청 비교: 겹치는 유일 후보 있음 - ${conflict.customer}`
    )
    return {
      decision: 'review',
      reason: `동점 - ${conflict.customer}도 같은 칸이 유일 후보`,
      options: [booking.customer || '예약1', conflict.customer || '예약2'],
      trace,
    }
  }

  trace.push(`5 같은 날 대기 요청 비교: 겹치는 유일 후보 없음`)

  // 결과
  if (autoOn) {
    trace.push(`결과: 확정-자동 - 빈 칸 ${firstCandidate} 확정`)
    return {
      decision: 'confirmed_auto',
      reason: `빈 칸 ${firstCandidate} 확정`,
      slotAssigned: firstCandidate,
      trace,
    }
  } else {
    trace.push(`결과: 대기 - 후보 ${firstCandidate} - 확정 버튼 대기`)
    return {
      decision: 'pending',
      reason: `후보 ${firstCandidate} - 확정 버튼 대기`,
      candidate: firstCandidate,
      trace,
    }
  }
}
