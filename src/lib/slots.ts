/**
 * 하루를 세 칸으로 나눈다. 시각 대신 이 칸으로 예약을 잡는다.
 * 저장할 때는 항상 이 한글 이름 그대로 쓴다 (폼·DB·판정이 같은 문자열을 봐야 한다).
 */
export const SLOTS = ['오전', '오후-1', '오후-2'] as const
export type Slot = (typeof SLOTS)[number]

export const SLOT_LABELS: Record<Slot, string> = {
  오전: '오전 10-12',
  '오후-1': '오후-1 13-15',
  '오후-2': '오후-2 15-17',
}

/** 구글 캘린더에 올릴 때 칸의 시작 시각. 시간 칸을 없앴으므로 여기서 만든다. */
export const SLOT_START_TIME: Record<Slot, string> = {
  오전: '10:00',
  '오후-1': '13:00',
  '오후-2': '15:00',
}

/** 종류별로 하루에 몇 칸이 필요한가 */
export const NEED: Record<string, number> = {
  서울: 1,
  내부: 1,
  경기: 2,
  지방: 3,
}

export function isSlot(s: string): s is Slot {
  return (SLOTS as readonly string[]).includes(s)
}

/**
 * 하이쿠 작업 때 영어 id 로 저장된 값이 DB 에 남아 있다.
 * 그대로 두면 화면에 "희망: 없음", "빈 칸 afternoon1 확정" 처럼 나온다.
 * db/06_normalize_slots.sql 로 한 번 정리하지만, 못 지운 값이 있어도 화면은 맞아야 하므로 여기서도 받아준다.
 */
const LEGACY: Record<string, Slot> = {
  morning: '오전',
  afternoon1: '오후-1',
  afternoon2: '오후-2',
  오전: '오전',
  '오후1': '오후-1',
  '오후2': '오후-2',
}

/** "오전, 오후-1" / "오전+오후-1" 처럼 저장된 문자열을 칸 배열로. 모르는 값은 버린다. */
export function parseSlots(s: string | null | undefined): Slot[] {
  if (!s) return []
  const out: Slot[] = []
  for (const raw of s.split(/[,+]/)) {
    const v = raw.trim()
    const slot = isSlot(v) ? v : LEGACY[v]
    if (slot && !out.includes(slot)) out.push(slot)
  }
  return out
}

/** 옛 예약이 남긴 reason·trace 안의 영어 id 도 읽을 수 있게 바꿔 보여준다. */
export function humanizeSlotText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\bafternoon1\b/g, '오후-1')
    .replace(/\bafternoon2\b/g, '오후-2')
    .replace(/\bmorning\b/g, '오전')
}

/** 저장용. 화면에는 joinSlotsForDisplay 를 쓴다. */
export function joinSlots(slots: readonly string[]): string {
  return slots.join(',')
}

/** 화면용. "오후-1+오후-2" */
export function joinSlotsForDisplay(slots: readonly string[]): string {
  return slots.join('+')
}

/**
 * 희망 칸 하나를 골랐을 때 실제로 비어 있어야 하는 칸들.
 * - 서울·내부: 그 칸 하나
 * - 경기: 그 칸 + 붙어 있는 한 칸 (오전->오전+오후-1, 오후-1->오후-1+오후-2, 오후-2->오후-1+오후-2)
 * - 지방: 하루 전부
 */
export function requiredSlots(kind: string, wanted: Slot): Slot[] {
  if (kind === '지방') return [...SLOTS]
  if (kind === '경기') {
    if (wanted === '오전') return ['오전', '오후-1']
    return ['오후-1', '오후-2']
  }
  return [wanted]
}

/** occupied 가 보는 최소 모양 */
export interface OccupancySource {
  date: string
  decision: string | null
  slot_assigned: string | null
}

/** 그 날짜에 확정(자동·수동)된 예약이 차지한 칸의 집합 */
export function occupied(date: string, bookings: readonly OccupancySource[]): Set<Slot> {
  const result = new Set<Slot>()
  for (const b of bookings) {
    if (b.date !== date) continue
    if (b.decision !== 'confirmed_auto' && b.decision !== 'confirmed_human') continue
    for (const s of parseSlots(b.slot_assigned)) result.add(s)
  }
  return result
}

/** 확정된 칸에서 캘린더용 시각을 만든다. 칸이 없으면 기존 time 을 그대로 쓴다. */
export function timeFromSlots(slotAssigned: string | null | undefined, fallback: string): string {
  const first = parseSlots(slotAssigned)[0]
  return first ? SLOT_START_TIME[first] : fallback
}
