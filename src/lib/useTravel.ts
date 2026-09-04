import { useEffect, useState } from 'react'
import { getTravelTo, type TravelResult } from './travel'
import { readBase } from './baseLocation'

export interface TravelTarget {
  id: number
  address: string | null
}

export type TravelMap = Record<number, TravelResult | 'loading'>

/**
 * 여러 예약의 이동 시간을 하나씩 채운다.
 *
 * 목적지 좌표는 날씨와 같은 지오코딩 캐시를 쓴다.
 * 날씨를 이미 조회한 주소라면 여기서는 경로 계산 한 번만 더 하면 된다.
 */
export function useTravel(targets: TravelTarget[]): TravelMap {
  const [map, setMap] = useState<TravelMap>({})

  const key = targets.map((t) => `${t.id}:${t.address ?? ''}`).join('|')

  useEffect(() => {
    let cancelled = false
    const list = targets.filter((t) => t.address)

    if (list.length === 0) {
      setMap({})
      return
    }

    const base = readBase()
    setMap(Object.fromEntries(list.map((t) => [t.id, 'loading' as const])))

    const run = async () => {
      for (const t of list) {
        if (cancelled) return
        const r = await getTravelTo(base, t.address)
        if (cancelled) return
        setMap((prev) => ({ ...prev, [t.id]: r }))
      }
    }
    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return map
}
