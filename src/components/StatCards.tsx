import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface Booking {
  id: number
  date: string
  status: string
}

interface StatCardsProps {
  refreshKey?: number
}

export default function StatCards({ refreshKey = 0 }: StatCardsProps) {
  const [todayCount, setTodayCount] = useState(0)
  const [confirmRate, setConfirmRate] = useState(0)
  const [weekCount, setWeekCount] = useState(0)

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, date, status')

      if (error) {
        console.error('통계 조회 실패:', error)
        return
      }

      const bookings = data as Booking[]

      // 오늘 날짜 (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0]

      // 1. 오늘 예약 수
      const today_count = bookings.filter((b) => b.date === today).length

      // 2. 확정률
      const confirmed_count = bookings.filter((b) => b.status === 'confirmed').length
      const total_count = bookings.length
      const rate = total_count > 0 ? ((confirmed_count / total_count) * 100).toFixed(1) : '0'

      // 3. 이번 주 총 건수 (월-금, 현재 날짜 기준)
      const now = new Date()
      const dayOfWeek = now.getDay()

      // 현재 주의 월요일
      const monday = new Date(now)
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      monday.setHours(0, 0, 0, 0)

      // 현재 주의 금요일
      const friday = new Date(monday)
      friday.setDate(monday.getDate() + 4)

      const monday_str = monday.toISOString().split('T')[0]
      const friday_str = friday.toISOString().split('T')[0]

      const week_count = bookings.filter(
        (b) => b.date >= monday_str && b.date <= friday_str
      ).length

      setTodayCount(today_count)
      setConfirmRate(parseFloat(rate))
      setWeekCount(week_count)
    }

    fetchStats()
  }, [refreshKey])

  const cards = [
    {
      label: '오늘 예약',
      value: todayCount,
      bgColor: 'bg-white',
      borderColor: 'border-[#e5e5e5]',
      shadowColor: 'shadow-[0_4px_0_#e5e5e5]',
      textColor: 'text-[#042c60]',
      badgeColor: 'bg-[#d7ffb8] text-[#58a700]',
      icon: '📅',
    },
    {
      label: '확정률',
      value: `${confirmRate.toFixed(1)}%`,
      bgColor: 'bg-white',
      borderColor: 'border-[#e5e5e5]',
      shadowColor: 'shadow-[0_4px_0_#e5e5e5]',
      textColor: 'text-[#58cc02]',
      badgeColor: 'bg-[#d7ffb8] text-[#58a700]',
      icon: '🎯',
    },
    {
      label: '이번 주 총',
      value: weekCount,
      bgColor: 'bg-white',
      borderColor: 'border-[#e5e5e5]',
      shadowColor: 'shadow-[0_4px_0_#e5e5e5]',
      textColor: 'text-[#1cb0f6]',
      badgeColor: 'bg-[#d7ffb8] text-[#58a700]',
      icon: '🔥',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-['Pretendard',sans-serif]">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`${card.bgColor} rounded-2xl p-6 border-2 ${card.borderColor} ${card.shadowColor} flex items-center justify-between transition-all hover:-translate-y-1`}
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
