import { useEffect, useState } from 'react'
import { describe, fetchCurrent, inForecastRange, type CurrentWeather } from '../lib/weather'
import { readBase, writeBase, type BaseLocation } from '../lib/baseLocation'
import { useTravel } from '../lib/useTravel'
import { departureTime } from '../lib/travel'
import { slotSpan } from '../lib/slots'
import TravelBadge from './TravelBadge'
import AddressSearch from './AddressSearch'
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
  // 출발지 바꾸기 패널
  const [editingBase, setEditingBase] = useState(false)
  const [baseQuery, setBaseQuery] = useState('')

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
  const travel = useTravel(upcoming.map((b) => ({ id: b.id, address: b.address })))

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
        <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
          <p className="text-[11px] font-black text-[#afafaf] uppercase tracking-wider">
            다가오는 외근 · 날씨와 이동 시간
          </p>
          <button
            onClick={() => setEditingBase((v) => !v)}
            className="text-[11px] font-bold text-[#1cb0f6] hover:underline cursor-pointer"
          >
            {editingBase ? '닫기' : `출발지: ${base.label} 바꾸기`}
          </button>
        </div>

        {/* 이동 시간의 출발지. 여기서 바꾸면 브라우저에 저장된다. */}
        {editingBase && (
          <div className="mb-3 p-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-xl">
            <AddressSearch
              value={baseQuery}
              onChange={setBaseQuery}
              onSelect={(r) => {
                const label = r.korean || r.display_name
                writeBase({ lat: r.lat, lon: r.lon, label })
                setBase({ lat: r.lat, lon: r.lon, label })
                setBaseQuery('')
                setEditingBase(false)
              }}
            />
            <p className="text-[11px] font-bold text-[#777777] mt-2">
              여기서 예약 장소까지의 차량 이동 시간을 계산합니다. 실시간 교통은 반영되지 않습니다.
            </p>
          </div>
        )}

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
                  <div className="flex flex-col items-start gap-1">
                    <WeatherBadge state={weather[b.id]} />
                    <TravelBadge
                      state={travel[b.id]}
                      departAt={(() => {
                        const t = travel[b.id]
                        if (!t || typeof t === 'string') return null
                        const span = slotSpan(b.slot_assigned)
                        return span ? departureTime(span.start, t.minutes) : null
                      })()}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
