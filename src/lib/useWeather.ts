import { useEffect, useState } from 'react'
import { getWeather, inForecastRange, type WeatherResult } from './weather'

export interface WeatherTarget {
  id: number
  date: string
  address: string | null
}

export type WeatherMap = Record<number, WeatherResult | 'loading'>

/**
 * 예약 여러 건의 날씨를 하나씩 채운다.
 *
 * 전부 기다렸다 한 번에 뿌리면 목록이 몇 초간 비어 보인다.
 * 받는 대로 그 줄만 바꿔 넣는다.
 */
export function useWeather(targets: WeatherTarget[]): WeatherMap {
  const [map, setMap] = useState<WeatherMap>({})

  // 대상이 실제로 달라졌을 때만 다시 부른다.
  // 배열은 렌더마다 새로 만들어지므로 내용을 문자열로 굳혀 비교한다.
  const key = targets.map((t) => `${t.id}:${t.date}:${t.address ?? ''}`).join('|')

  useEffect(() => {
    let cancelled = false
    const list = targets.filter((t) => t.address && inForecastRange(t.date))

    if (list.length === 0) {
      setMap({})
      return
    }

    setMap(Object.fromEntries(list.map((t) => [t.id, 'loading' as const])))

    const run = async () => {
      for (const t of list) {
        if (cancelled) return
        const w = await getWeather(t.address, t.date)
        if (cancelled) return
        setMap((prev) => ({ ...prev, [t.id]: w }))
      }
    }
    run()

    return () => {
      cancelled = true
    }
    // key 에 대상 정보가 다 들어 있다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return map
}
