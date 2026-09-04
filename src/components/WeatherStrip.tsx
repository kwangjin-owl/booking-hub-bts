import { useEffect, useState } from 'react'
import { describe, fetchCurrent, inForecastRange, type CurrentWeather } from '../lib/weather'
import { readBase, type BaseLocation } from '../lib/baseLocation'
import { useWeather } from '../lib/useWeather'
import { joinSlotsForDisplay, parseSlots } from '../lib/slots'
import type { BookingRow } from '../lib/types'
import WeatherBadge from './WeatherBadge'

interface WeatherStripProps {
  bookings: BookingRow[]
}

/** 다가오는 확정 외근을 몇 건까지 볼지. 한 건당 지오코딩 1회라 너무 늘리면 느리다. */
const LIMIT = 4

/** 'YYYY-MM-DD' -> '9/5 (금)' */
function shortDay(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()} (${week})`
}

/**
 * 대시보드 맨 위 날씨 줄.
 *
 * 왼쪽은 지금 기준 위치의 날씨, 오른쪽은 다가오는 확정 외근의 그 날 예보.
 * 세로로 길어지면 판정 흐름도가 밀려나므로 한 줄 안에 담는다.
 */
export default function WeatherStrip({ bookings }: WeatherStripProps) {
  const [base, setBase] = useState<BaseLocation>(readBase)
  const [current, setCurrent] = useState<CurrentWeather | string | 'loading'>('loading')
  // 브라우저 위치를 쓰고 있는지. 거절하면 기준 위치로 돌아간다.
  const [usingDevice, setUsingDevice] = useState(false)

  // 브라우저가 위치를 주면 그걸 쓰고, 막히거나 느리면 기준 위치로 간다.
  useEffect(() => {
    let cancelled = false
    const saved = readBase()
    setBase(saved)

    const load = async (lat: number, lon: number) => {
      const w = await fetchCurrent({ lat, lon })
      if (!cancelled) setCurrent(w)
    }

    if (!navigator.geolocation) {
      load(saved.lat, saved.lon)
      return () => {
        cancelled = true
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        setUsingDevice(true)
        load(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        // 거절했거나 실패. 물어보지 않고 조용히 기준 위치를 쓴다.
        if (!cancelled) load(saved.lat, saved.lon)
      },
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    )

    return () => {
      cancelled = true
    }
  }, [])

  // 다가오는 확정 외근. 목록 표와 같은 기준이다.
  const upcoming = bookings
    .filter(
      (b) =>
        b.form === '외근' &&
        (b.status === 'confirmed' ||
          b.decision === 'confirmed_auto' ||
          b.decision === 'confirmed_human') &&
        !!b.address &&
        inForecastRange(b.date),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, LIMIT)

  const weather = useWeather(
    upcoming.map((b) => ({ id: b.id, date: b.date, address: b.address })),
  )

  const info = typeof current === 'object' ? describe(current.code) : null

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {/* 지금 날씨 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-2xl shadow-[0_4px_0_#e5e5e5] min-w-[220px]">
        <span className="text-3xl">{info ? info.icon : '⏳'}</span>
        <div>
          <p className="text-[11px] font-black text-[#afafaf] uppercase tracking-wider">
            지금 · {usingDevice ? '현재 위치' : base.label}
          </p>
          {current === 'loading' ? (
            <p className="text-sm font-bold text-[#afafaf]">불러오는 중...</p>
          ) : typeof current === 'string' ? (
            <p className="text-sm font-bold text-[#afafaf]">{current}</p>
          ) : (
            <p className="text-lg font-black text-[#042c60] leading-tight">
              {current.temp}°{' '}
              <span className="text-xs font-bold text-[#777777]">
                {info?.label} · 체감 {current.feels}°
                {current.precip > 0 && ` · ${current.precip}mm`}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* 다가오는 확정 외근 */}
      <div className="flex-1 min-w-[280px] px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-2xl shadow-[0_4px_0_#e5e5e5]">
        <p className="text-[11px] font-black text-[#afafaf] uppercase tracking-wider mb-2">
          다가오는 외근 날씨
        </p>

        {upcoming.length === 0 ? (
          <p className="text-sm font-bold text-[#afafaf]">확정된 외근 예약이 없습니다</p>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {upcoming.map((b) => {
              const slots = parseSlots(b.slot_assigned)
              return (
                <div key={b.id} className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#042c60] truncate max-w-[140px]">
                      {b.customer}
                    </p>
                    <p className="text-[11px] font-bold text-[#777777]">
                      {shortDay(b.date)}
                      {slots.length > 0 && ` · ${joinSlotsForDisplay(slots)}`}
                    </p>
                  </div>
                  <WeatherBadge state={weather[b.id]} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
