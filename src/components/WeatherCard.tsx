import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { todayString } from '../lib/weather'
import { useWeather } from '../lib/useWeather'
import { joinSlotsForDisplay, parseSlots } from '../lib/slots'
import WeatherBadge from './WeatherBadge'

interface Booking {
  id: number
  customer: string
  date: string
  address: string | null
  slot_assigned: string | null
  slots_wanted: string | null
}

interface WeatherCardProps {
  refreshKey?: number
}

/** 다가오는 예약 중 몇 건까지 볼지. 한 건당 지오코딩 1회라 너무 늘리면 느리다. */
const LIMIT = 5

/**
 * 다가오는 예약의 날씨.
 *
 * 조회는 lib/weather.ts 가 한다. 예약 목록 표도 같은 모듈을 쓰기 때문에
 * Nominatim 초당 1회 제한을 두 화면이 함께 지키게 된다.
 */
export default function WeatherCard({ refreshKey = 0 }: WeatherCardProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      // RLS 가 걸러준다. 일반 사용자는 자기 예약만 돌아온다.
      const { data } = await supabase
        .from('bookings')
        .select('id, customer, date, address, slot_assigned, slots_wanted')
        .gte('date', todayString())
        .order('date', { ascending: true })
        .limit(LIMIT)

      if (cancelled) return
      setBookings((data as Booking[]) ?? [])
      setLoading(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const weather = useWeather(
    bookings.map((b) => ({ id: b.id, date: b.date, address: b.address })),
  )

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] font-['Pretendard',sans-serif]">
        <p className="text-[#777777] font-bold text-sm">예약을 불러오는 중...</p>
      </div>
    )
  }

  if (bookings.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] overflow-hidden font-['Pretendard',sans-serif]">
      <div className="px-6 py-4 bg-[#f7f7f7] border-b-2 border-[#e5e5e5]">
        <h3 className="text-sm font-black text-[#042c60]">
          가장 가까운 예약 {bookings.length}건의 날씨
        </h3>
      </div>

      <div className="divide-y-2 divide-[#e5e5e5]">
        {bookings.map((b) => {
          const assigned = parseSlots(b.slot_assigned)
          const wanted = parseSlots(b.slots_wanted)
          return (
            <div key={b.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-black text-[#042c60] truncate">{b.customer}</p>
                <p className="text-xs text-[#777777] font-bold">
                  {b.date}{' '}
                  {assigned.length > 0
                    ? joinSlotsForDisplay(assigned)
                    : wanted.length > 0
                      ? `희망 ${wanted.join(' > ')}`
                      : ''}
                </p>
              </div>
              <div className="flex-shrink-0">
                <WeatherBadge state={weather[b.id]} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
