import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface Booking {
  id: number
  date: string
  status: string
}

interface StatCardsProps {
  refreshKey?: number
  isAdmin?: boolean
}

/** 오늘 날짜를 로컬 기준 'YYYY-MM-DD' 로 만든다. toISOString 은 UTC 라 하루가 밀릴 수 있다. */
function todayString() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function StatCards({ refreshKey = 0, isAdmin = false }: StatCardsProps) {
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

      const bookings = (data ?? []) as Booking[]
      const today = todayString()

      // '오늘 예약'은 대부분 0 이라 화면에서 쓸모가 없었다.
      // 오늘 이후로 남은 일정을 세는 편이 실제로 궁금한 숫자에 가깝다.
      setUpcoming(bookings.filter((b) => b.date >= today).length)
      setPending(bookings.filter((b) => b.status === 'pending').length)
      setConfirmed(bookings.filter((b) => b.status === 'confirmed').length)
    }

    fetchStats()
  }, [refreshKey])

  const cards = [
    {
      label: '다가오는 예약',
      value: upcoming,
      textColor: 'text-[#042c60]',
      icon: '📅',
    },
    {
      label: isAdmin ? '확정 대기' : '확정 대기 중',
      value: pending,
      textColor: 'text-[#e6b400]',
      icon: '⏳',
    },
    {
      label: '확정 완료',
      value: confirmed,
      textColor: 'text-[#58cc02]',
      icon: '✅',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-['Pretendard',sans-serif]">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-2xl p-6 border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] flex items-center justify-between transition-all hover:-translate-y-1"
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
        </div>
      ))}
    </div>
  )
}
