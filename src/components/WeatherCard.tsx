import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface Booking {
  id: number
  customer: string
  date: string
  time: string
  address: string | null
}

interface Weather {
  code: number
  max: number
  min: number
  rainChance: number
}

interface Row {
  booking: Booking
  /** 'loading' 조회 중 · Weather 성공 · string 실패 사유 */
  weather: 'loading' | Weather | string
}

interface WeatherCardProps {
  refreshKey?: number
}

/** 다가오는 예약 중 몇 건까지 날씨를 볼지. 한 건당 1초쯤 걸린다. */
const LIMIT = 5

/** WMO 날씨 코드를 아이콘과 한글 설명으로 바꾼다. */
function describe(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: '맑음' }
  if (code <= 2) return { icon: '🌤️', label: '구름 조금' }
  if (code === 3) return { icon: '☁️', label: '흐림' }
  if (code <= 48) return { icon: '🌫️', label: '안개' }
  if (code <= 57) return { icon: '🌦️', label: '이슬비' }
  if (code <= 67) return { icon: '🌧️', label: '비' }
  if (code <= 77) return { icon: '🌨️', label: '눈' }
  if (code <= 82) return { icon: '🌧️', label: '소나기' }
  if (code <= 86) return { icon: '🌨️', label: '소낙눈' }
  return { icon: '⛈️', label: '뇌우' }
}

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 예약 한 건의 날씨를 가져온다. 실패하면 사유 문자열을 돌려준다. */
async function fetchWeather(booking: Booking): Promise<Weather | string> {
  if (!booking.address) return '주소 없음'

  try {
    // 1) 주소 -> 좌표
    const geoUrl = new URL('https://nominatim.openstreetmap.org/search')
    geoUrl.searchParams.append('q', booking.address)
    geoUrl.searchParams.append('format', 'json')
    geoUrl.searchParams.append('limit', '1')
    geoUrl.searchParams.append('countrycodes', 'kr')

    const geo = await (await fetch(geoUrl.toString())).json()
    if (!geo?.[0]) return '위치를 찾지 못함'

    // 2) 좌표 + 날짜 -> 예보
    const wUrl = new URL('https://api.open-meteo.com/v1/forecast')
    wUrl.searchParams.append('latitude', geo[0].lat)
    wUrl.searchParams.append('longitude', geo[0].lon)
    wUrl.searchParams.append(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    )
    wUrl.searchParams.append('timezone', 'Asia/Seoul')
    wUrl.searchParams.append('start_date', booking.date)
    wUrl.searchParams.append('end_date', booking.date)

    const daily = (await (await fetch(wUrl.toString())).json())?.daily

    if (daily?.weather_code?.[0] === undefined || daily.weather_code[0] === null) {
      // Open-Meteo 는 보통 16일치까지만 준다.
      return '예보 범위 밖'
    }

    return {
      code: daily.weather_code[0],
      max: Math.round(daily.temperature_2m_max[0]),
      min: Math.round(daily.temperature_2m_min[0]),
      rainChance: daily.precipitation_probability_max?.[0] ?? 0,
    }
  } catch {
    return '날씨를 불러오지 못함'
  }
}

export default function WeatherCard({ refreshKey = 0 }: WeatherCardProps) {
  const [rows, setRows] = useState<Row[]>([])
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoadingList(true)

      const { data, error } = await supabase
        .from('bookings')
        .select('id, customer, date, time, address')
        .gte('date', todayString())
        .order('date', { ascending: true })
        .limit(LIMIT)

      if (cancelled) return

      if (error || !data || data.length === 0) {
        setRows([])
        setLoadingList(false)
        return
      }

      const bookings = data as Booking[]

      // 예약 목록은 먼저 보여주고, 날씨는 뒤에서 하나씩 채운다.
      // 전부 기다렸다 뿌리면 화면이 몇 초간 비어 보인다.
      setRows(bookings.map((booking) => ({ booking, weather: 'loading' })))
      setLoadingList(false)

      // Nominatim 은 초당 1회 제한이 있어 한 건씩 차례로 부른다.
      for (const booking of bookings) {
        if (cancelled) return
        const weather = await fetchWeather(booking)
        if (cancelled) return

        setRows((prev) =>
          prev.map((row) => (row.booking.id === booking.id ? { ...row, weather } : row)),
        )
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (loadingList) {
    return (
      <div className="bg-white rounded-2xl p-6 border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] font-['Pretendard',sans-serif]">
        <p className="text-[#777777] font-bold text-sm">예약을 불러오는 중...</p>
      </div>
    )
  }

  if (rows.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] overflow-hidden font-['Pretendard',sans-serif]">
      <div className="px-6 py-4 bg-[#f7f7f7] border-b-2 border-[#e5e5e5]">
        <h3 className="text-sm font-black text-[#042c60]">
          가장 가까운 예약 {rows.length}건의 날씨
        </h3>
      </div>

      <div className="divide-y-2 divide-[#e5e5e5]">
        {rows.map(({ booking, weather }) => {
          const isLoading = weather === 'loading'
          const isFailed = typeof weather === 'string' && !isLoading
          const info = !isLoading && !isFailed ? describe((weather as Weather).code) : null

          return (
            <div key={booking.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-black text-[#042c60] truncate">{booking.customer}</p>
                <p className="text-xs text-[#777777] font-bold">
                  {booking.date} {booking.time}
                </p>
              </div>

              {isLoading && (
                <span className="text-xs font-bold text-[#afafaf] flex-shrink-0">조회 중...</span>
              )}

              {isFailed && (
                <span className="text-xs font-bold text-[#afafaf] flex-shrink-0">
                  {weather as string}
                </span>
              )}

              {info && (
                <div className="flex items-center gap-4 flex-shrink-0">
                  {(weather as Weather).rainChance >= 50 && (
                    <span className="hidden sm:inline text-[11px] font-black text-[#1cb0f6] bg-[#e5f4ff] px-2.5 py-1 rounded-full">
                      강수 {(weather as Weather).rainChance}%
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-xs font-bold text-[#777777]">{info.label}</p>
                    <p className="text-sm font-black text-[#3c3c3c]">
                      {(weather as Weather).min}° / {(weather as Weather).max}°
                    </p>
                  </div>
                  <span className="text-3xl">{info.icon}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}