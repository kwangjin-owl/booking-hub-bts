import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface Booking {
  id: number
  date: string
  status: string
}

export type StatTarget = 'all' | 'pending' | 'confirmed'

interface StatCardsProps {
  refreshKey?: number
  /** 카드를 누르면 예약 목록으로 넘어가며 해당 필터가 걸린다. */
  onSelect?: (target: StatTarget) => void
}

/** 로컬 기준 오늘 'YYYY-MM-DD'. toISOString 은 UTC 라 하루가 밀릴 수 있다. */
function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function StatCards({ refreshKey = 0, onSelect }: StatCardsProps) {
  const [upcoming, setUpcoming] = useState(0)
  const [pending, setPending] = useState(0)
  const [confirmed, setConfirmed] = useState(0)

  useEffect(() => {
    const fetchStats = async () => {
      // RLS 가 걸러준다. 관리자는 전체, 그 외에는 자기 예약만 돌아온다.
      const { data, error } = await supabase.from('bookings').select('id, date, status')

      if (error) {
        console.error('통계 조회 실패:', error)
        return
      }

      const today = todayString()

      // 예약 목록 화면과 같은 기준을 쓴다.
      // 한쪽만 지난 예약을 세면 '다가오는 6건인데 대기 8건' 같은 숫자가 나온다.
      const rows = ((data ?? []) as Booking[]).filter((b) => b.date >= today)

      setUpcoming(rows.length)
      setPending(rows.filter((b) => b.status === 'pending').length)
      setConfirmed(rows.filter((b) => b.status === 'confirmed').length)
    }

    fetchStats()
  }, [refreshKey])

  const cards: { label: string; value: number; textColor: string; icon: string; target: StatTarget }[] =
    [
      { label: '다가오는 예약', value: upcoming, textColor: 'text-[#042c60]', icon: '📅', target: 'all' },
      { label: '확정 대기', value: pending, textColor: 'text-[#e6b400]', icon: '⏳', target: 'pending' },
      { label: '확정 완료', value: confirmed, textColor: 'text-[#58cc02]', icon: '✅', target: 'confirmed' },
    ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-['Pretendard',sans-serif]">
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          onClick={() => onSelect?.(card.target)}
          disabled={!onSelect}
          title={onSelect ? '눌러서 해당 예약 목록 보기' : undefined}
          className={`text-left bg-white rounded-2xl p-6 border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] flex items-center justify-between transition-all ${
            onSelect
              ? 'cursor-pointer hover:-translate-y-1 hover:border-[#58cc02] active:translate-y-0 active:shadow-none'
              : 'cursor-default'
          }`}
        >
          <div>
            <span className="inline-block text-xs font-black uppercase tracking-wider text-[#777777] mb-1">
              {card.label}
            </span>
            <p className={`text-4xl font-black ${card.textColor}`}>{card.value}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#f7f7f7] border-2 border-[#e5e5e5] flex items-center justify-center text-2xl shadow-[0_3px_0_#e5e5e5]">
            {card.icon}
          </div>
        </button>
      ))}
    </div>
  )
}