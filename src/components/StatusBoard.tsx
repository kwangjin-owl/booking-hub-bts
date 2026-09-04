import { DECISION_LABELS } from '../lib/decisionMeta'
import { humanizeSlotText, joinSlotsForDisplay, parseSlots } from '../lib/slots'
import type { BookingRow, Decision } from '../lib/types'

interface StatusBoardProps {
  bookings: BookingRow[]
}

const COLUMNS: { key: Decision; bg: string; border: string }[] = [
  { key: 'pending', bg: 'bg-[#f7f7f7]', border: 'border-[#cfcfcf]' },
  { key: 'confirmed_auto', bg: 'bg-[#d7ffb8]/50', border: 'border-[#58cc02]' },
  { key: 'confirmed_human', bg: 'bg-white', border: 'border-[#58cc02]' },
  { key: 'review', bg: 'bg-[#fff8e6]', border: 'border-[#ffc800]' },
  { key: 'rejected', bg: 'bg-[#ffebeb]', border: 'border-[#ff4b4b]' },
  { key: 'asking', bg: 'bg-[#e6f4ff]', border: 'border-[#1cb0f6]' },
]

/** 상태별 여섯 칸. 데이터는 Dashboard 가 realtime 으로 갱신해 준다. */
export default function StatusBoard({ bookings }: StatusBoardProps) {
  const grouped: Record<Decision, BookingRow[]> = {
    pending: [],
    confirmed_auto: [],
    confirmed_human: [],
    review: [],
    rejected: [],
    asking: [],
  }
  for (const b of bookings) {
    const d = (b.decision ?? 'pending') as Decision
    if (grouped[d]) grouped[d].push(b)
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  }

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-lg font-black text-[#042c60]">상태 보드</h3>
        <p className="text-xs text-[#777777] font-bold mt-1">예약이 지금 어느 칸에 있는지</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const items = grouped[col.key]
          return (
            <div key={col.key} className={`${col.bg} border-2 ${col.border} rounded-2xl p-3 h-[340px] flex flex-col`}>
              <div className="mb-3 pb-2 border-b-2 border-black/5 flex items-baseline justify-between">
                <h4 className="font-black text-sm text-[#042c60]">{DECISION_LABELS[col.key]}</h4>
                <span className="text-xs font-black text-[#777777]">{items.length}</span>
              </div>

              {/* 한 열만 길어져도 나머지 빈 열까지 늘어나지 않게 높이를 묶는다 */}
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <p className="text-[11px] text-[#afafaf] font-bold text-center py-6">없음</p>
                ) : (
                  items.map((b) => {
                    const assigned = parseSlots(b.slot_assigned)
                    return (
                      <div key={b.id} className="bg-white rounded-xl p-2.5 border-2 border-black/5">
                        <p className="font-black text-sm text-[#042c60] leading-tight">{b.customer}</p>
                        <p className="text-[11px] text-[#777777] font-bold mt-0.5">
                          {b.date} · {b.kind ?? '-'}·{b.form ?? '-'}
                        </p>
                        {b.memo && <p className="text-[11px] text-[#555555] font-bold truncate">{b.memo}</p>}
                        {assigned.length > 0 ? (
                          <p className="text-[11px] font-black text-[#58a700] mt-1">✓ {joinSlotsForDisplay(assigned)}</p>
                        ) : (
                          b.reason && (
                            <p className="text-[11px] text-[#777777] font-bold mt-1 line-clamp-2">
                              {humanizeSlotText(b.reason)}
                            </p>
                          )
                        )}
                        {col.key === 'review' && b.options && (
                          <p className="text-[10px] text-[#8a6d00] font-bold mt-1">
                            {b.options.split(',').join(' vs ')}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
