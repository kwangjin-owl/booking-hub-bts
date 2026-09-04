import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { decide, type Booking as DecideBooking } from '../lib/decide'

export default function AutoJudgeControl() {
  const [autoOn, setAutoOn] = useState(() => {
    const stored = localStorage.getItem('auto-judge')
    return stored === 'false' ? false : true
  })
  const [judging, setJudging] = useState(false)

  useEffect(() => {
    localStorage.setItem('auto-judge', autoOn.toString())
  }, [autoOn])

  const handleJudgeAll = async () => {
    setJudging(true)
    try {
      const { data: allBookings } = await supabase.from('bookings').select('*')

      if (!allBookings) {
        setJudging(false)
        return
      }

      const pending = allBookings.filter((b) => b.decision === 'pending')

      for (const booking of pending) {
        const decideBooking: DecideBooking = {
          id: booking.id,
          kind: booking.kind,
          date: booking.date,
          slots_wanted: booking.slots_wanted,
          decision: booking.decision,
          slot_assigned: booking.slot_assigned,
          reason: booking.reason,
          options: booking.options,
          trace: booking.trace,
          customer: booking.customer,
        }

        const result = decide(decideBooking, allBookings, autoOn)

        await supabase
          .from('bookings')
          .update({
            decision: result.decision,
            slot_assigned: result.slotAssigned || null,
            reason: result.reason,
            options: result.options ? result.options.join(',') : null,
            trace: result.trace.join('\n'),
          })
          .eq('id', booking.id)
      }
    } catch (err) {
      console.error('전부 판정 실패:', err)
    } finally {
      setJudging(false)
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-['Pretendard',sans-serif]">
      <label className="flex items-center gap-3 cursor-pointer flex-1">
        <input
          type="checkbox"
          checked={autoOn}
          onChange={(e) => setAutoOn(e.target.checked)}
          disabled={judging}
          className="w-5 h-5 accent-[#58cc02]"
        />
        <span className="text-sm font-black text-[#3c3c3c]">
          자동 판정 {autoOn ? '활성' : '비활성'}
        </span>
        <span className="text-xs text-[#777777] font-bold">
          {autoOn ? '새 예약은 자동 확정됩니다' : '새 예약은 수동 검토 대기'}
        </span>
      </label>

      <button
        onClick={handleJudgeAll}
        disabled={judging}
        className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap ${
          judging
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-[#58cc02] hover:bg-[#46a302] text-white shadow-[0_2px_0_#46a302] active:translate-y-[2px] active:shadow-none'
        }`}
      >
        {judging ? '판정 중...' : '전부 판정'}
      </button>
    </div>
  )
}
