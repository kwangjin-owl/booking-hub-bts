import { formatMinutes, type Travel, type TravelResult } from '../lib/travel'

interface TravelBadgeProps {
  state: TravelResult | 'loading' | undefined
  /** 있으면 '출발 09:20' 을 같이 보여준다 */
  departAt?: string | null
}

/** 목록·대시보드에 붙는 이동 시간 표시 */
export default function TravelBadge({ state, departAt }: TravelBadgeProps) {
  if (state === undefined) return null

  if (state === 'loading') {
    return <span className="text-[10px] font-bold text-[#cfcfcf]">이동 시간 계산 중...</span>
  }

  if (typeof state === 'string') {
    return <span className="text-[10px] font-bold text-[#cfcfcf]">{state}</span>
  }

  const t = state as Travel
  // 한 시간을 넘으면 하루 일정에 영향을 준다. 눈에 띄게 한다.
  const far = t.minutes >= 60

  return (
    <span
      title={`기준 위치에서 차로 ${formatMinutes(t.minutes)}, ${t.km}km (실시간 교통 미반영)`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black border-2 ${
        far
          ? 'bg-[#fff8e6] border-[#ffc800] text-[#8a6d00]'
          : 'bg-[#f7f7f7] border-[#e5e5e5] text-[#777777]'
      }`}
    >
      <span>🚗</span>
      <span>{formatMinutes(t.minutes)}</span>
      <span className="font-bold opacity-70">{t.km}km</span>
      {departAt && <span className="font-black">· 출발 {departAt}</span>}
    </span>
  )
}
