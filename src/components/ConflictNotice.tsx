import type { Conflict } from '../lib/useConflicts'

interface ConflictNoticeProps {
  conflicts: Conflict[]
}

/** 겹치는 예약을 알려준다. 막지는 않는다 — 담당자가 다르거나 이동이 가능할 수 있다. */
export default function ConflictNotice({ conflicts }: ConflictNoticeProps) {
  if (conflicts.length === 0) return null

  return (
    <div className="p-4 bg-[#ffc800]/15 border-2 border-[#ffc800] rounded-2xl">
      <p className="text-xs font-black text-[#8a6d00] mb-1">
        같은 날 비슷한 시간에 예약이 {conflicts.length}건 있습니다
      </p>
      <p className="text-xs font-bold text-[#8a6d00]">
        {conflicts.map((c) => `${c.booking_time} ${c.customer}`).join(' · ')}
      </p>
    </div>
  )
}
