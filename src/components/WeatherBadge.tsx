import { describe, isWet, type Weather, type WeatherResult } from '../lib/weather'

interface WeatherBadgeProps {
  state: WeatherResult | 'loading' | undefined
}

/**
 * 목록 한 줄에 붙는 작은 날씨 표시.
 * 비·눈이 예상되면 파랗게 강조한다 - 외근인데 우산이 필요한 날을 놓치지 않으려는 것이다.
 */
export default function WeatherBadge({ state }: WeatherBadgeProps) {
  if (state === undefined) return null

  if (state === 'loading') {
    return <span className="text-[10px] font-bold text-[#cfcfcf]">날씨 조회 중...</span>
  }

  if (typeof state === 'string') {
    return <span className="text-[10px] font-bold text-[#cfcfcf]">{state}</span>
  }

  const w = state as Weather
  const { icon, label } = describe(w.code)
  const wet = isWet(w)

  return (
    <span
      title={`${label} · 최저 ${w.min}° 최고 ${w.max}° · 강수 확률 ${w.rainChance}%`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black border-2 ${
        wet
          ? 'bg-[#e5f4ff] border-[#1cb0f6] text-[#0d99dc]'
          : 'bg-[#f7f7f7] border-[#e5e5e5] text-[#777777]'
      }`}
    >
      <span>{icon}</span>
      <span>
        {w.min}°/{w.max}°
      </span>
      {wet && <span>☔{w.rainChance}%</span>}
    </span>
  )
}
