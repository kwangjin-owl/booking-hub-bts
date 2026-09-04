/**
 * 기준 위치(출발지)에서 예약 장소까지 차로 얼마나 걸리는지.
 *
 * OSRM 공개 서버를 쓴다. 키가 필요 없고 CORS 도 열려 있다.
 * 대신 **실시간 교통을 반영하지 않는다** - 도로 제한속도로 계산한 값이라
 * 서울 출퇴근 시간대에는 실제보다 짧게 나온다. 화면에도 그렇게 적어 둔다.
 *
 * 더 정확하게 하려면 카카오모빌리티 길찾기로 바꾼다.
 * 그 경우 REST 키가 필요하고, 키를 브라우저에 두면 안 되므로
 * api/ 아래 서버 함수를 하나 더 만들어 거기서 불러야 한다.
 */
import { geocode, type Coords } from './weather'

export interface Travel {
  /** 분 */
  minutes: number
  /** km */
  km: number
}

export type TravelResult = Travel | string

const cache = new Map<string, Travel>()

/** 좌표를 소수점 4자리로 줄여 캐시 키를 만든다 (약 10m 단위) */
function key(from: Coords, to: Coords): string {
  const r = (n: number) => n.toFixed(4)
  return `${r(from.lat)},${r(from.lon)}>${r(to.lat)},${r(to.lon)}`
}

export async function getTravelBetween(from: Coords, to: Coords): Promise<TravelResult> {
  const k = key(from, to)
  const hit = cache.get(k)
  if (hit) return hit

  try {
    // OSRM 은 경도,위도 순서다. 위도,경도로 넣으면 엉뚱한 곳이 나온다.
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}` +
      `?overview=false&alternatives=false&steps=false`

    const res = await fetch(url)
    const json = await res.json()
    const route = json?.routes?.[0]

    if (!route) return json?.code === 'NoRoute' ? '경로 없음' : '이동 시간을 못 받음'

    const travel: Travel = {
      minutes: Math.round(route.duration / 60),
      km: Math.round(route.distance / 100) / 10,
    }
    cache.set(k, travel)
    return travel
  } catch {
    return '이동 시간을 못 받음'
  }
}

/** 주소 문자열로 바로. 좌표는 weather.ts 의 geocode 를 그대로 쓴다(캐시·초당 1회 큐 공유). */
export async function getTravelTo(
  from: Coords,
  address: string | null | undefined,
): Promise<TravelResult> {
  if (!address) return '주소 없음'
  const to = await geocode(address)
  if (!to) return '위치를 찾지 못함'
  return getTravelBetween(from, to)
}

/** 42 -> '42분', 95 -> '1시간 35분' */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/**
 * 슬롯 시작 시각에 맞추려면 언제 나서야 하는지.
 * 이동 시간에 여유 10분을 더해 뺀다. 자정을 넘어가면 null.
 */
export function departureTime(startTime: string, minutes: number, buffer = 10): string | null {
  const [h, m] = startTime.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const total = h * 60 + m - minutes - buffer
  if (total < 0) return null
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
