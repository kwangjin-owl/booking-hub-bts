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
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: '확정률',
      value: `${confirmRate.toFixed(1)}%`,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      label: '이번 주 총',
      value: weekCount,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`${card.bgColor} rounded-lg p-6 shadow-sm border border-gray-200`}
        >
          <p className="text-sm text-gray-600 mb-2">{card.label}</p>
          <p className={`text-3xl font-bold ${card.textColor}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
