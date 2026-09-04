export const SLOTS = ['오전', '오후-1', '오후-2']

export const NEED: Record<string, number> = {
  서울: 1,
  내부: 1,
  경기: 2,
  지방: 3,
}

export function requiredSlots(kind: string, wanted: string[]): string[] {
  const firstWanted = wanted[0]

  if (!firstWanted) return []

  if (kind === '서울' || kind === '내부') {
    return [firstWanted]
  }

  if (kind === '경기') {
    const idx = SLOTS.indexOf(firstWanted)
    if (idx === 0) return ['오전', '오후-1']
    if (idx === 1) return ['오후-1', '오후-2']
    if (idx === 2) return ['오후-1', '오후-2']
    return [firstWanted]
  }

  if (kind === '지방') {
    return SLOTS
  }

  return [firstWanted]
}

export interface Booking {
  date: string
  decision: string
  slot_assigned?: string
}

export function occupied(date: string, bookings: Booking[]): Set<string> {
  const result = new Set<string>()
  bookings.forEach((b) => {
    if (b.date === date && (b.decision === 'confirmed_auto' || b.decision === 'confirmed_human')) {
      if (b.slot_assigned) {
        b.slot_assigned.split(',').forEach((s) => result.add(s.trim()))
      }
    }
  })
  return result
}
