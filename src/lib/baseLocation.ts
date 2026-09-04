/**
 * 기준 위치 - "우리가 출발하는 곳".
 *
 * 지금은 대시보드의 현재 날씨에 쓰고,
 * 나중에 이동 시간(여기서 목적지까지 몇 분)에도 같은 값을 쓴다.
 *
 * 값은 브라우저에 저장한다. 사람마다 사무실이 다를 수 있고,
 * 이것 때문에 DB 컬럼을 늘릴 만큼 중요한 정보는 아니다.
 */
export interface BaseLocation {
  lat: number
  lon: number
  label: string
}

/** 못 정했을 때 쓸 값 (서울시청) */
export const DEFAULT_BASE: BaseLocation = {
  lat: 37.5665,
  lon: 126.978,
  label: '서울시청',
}

const KEY = 'base-location'

export function readBase(): BaseLocation {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_BASE
    const parsed = JSON.parse(raw)
    if (typeof parsed?.lat === 'number' && typeof parsed?.lon === 'number') {
      return { lat: parsed.lat, lon: parsed.lon, label: parsed.label || '기준 위치' }
    }
  } catch {
    // 값이 깨져 있으면 기본값으로 돌아간다
  }
  return DEFAULT_BASE
}

export function writeBase(base: BaseLocation) {
  localStorage.setItem(KEY, JSON.stringify(base))
}
